import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from 'rehype-raw';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // Import KaTeX styles

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import "react-data-grid/lib/styles.css";


import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Menu, Item, Separator, Submenu, useContextMenu } from 'react-contexify';
import 'react-contexify/ReactContexify.css';
import './Grid.css';

const MENU_ID_COLUMN = 'menu_col';
const MENU_ID_ROW = 'menu_row';
const MENU_ID_NOTE = 'menu_note';

function setifyTags(...lists) {
  return new Set(lists.flat());
}

function concatTags(...lists) {
  // Flatten the lists, concatenate them, and remove duplicates using Set
  return [...setifyTags(...lists)];
}

const extractTagsSet = (text) => {
  return setifyTags(text.match(/#\w+/g) || []); // Extract hashtags and store them in a Set
}

const extractTags = (text) => {
  return [...extractTagsSet(text)];
};

const extractTagsOrGenerateNew = (text, newTagPrefix) => {
  const tags = extractTags(text);
  if (tags.length === 0) {
    const tag = '#' + newTagPrefix + `${Math.random().toString(36).substr(2, 9)}`;
    tags.push(tag);
    text += ' ' + tag;
  }
  return [text, tags];
}

const removeAllTagsFromText = (text) => {
  return text.replace(/#\w+[ ]?/g, "").trim(); // Remove all hashtags
};

const removeTagsFromText = (text, tags = []) => {
  if (tags.length === 0) {
    // If no specific tags are provided, return the original text unchanged
    return text;
  } else {
    // Create a regular expression pattern to match the specific tags as whole words
    const pattern = new RegExp(`(${tags.join('|')})([ ]|\\b)`, 'g');
    // Replace the matched tags with an empty string
    return text.replace(pattern, '').trim();
  }
};

const addTagsToText = (text, tags) => {
  if (tags.length === 0) return;
  return removeTagsFromText(text, tags).concat(' ').concat(tags.join(' '));
};

const newHeader = ((title) => {
  const id = `${Math.random().toString(36).substr(2, 9)}`
  const [title_new, tags] = extractTagsOrGenerateNew(title, 'head')
  return {id : id, title: title_new, tags: tags}
});

const defaultRows = [newHeader(""), newHeader("1 #row1"), newHeader("2 #row2"), newHeader("3 #row3")];
const defaultCols = [newHeader(""), newHeader("a #col1"), newHeader("b #col2"), newHeader("c #col3")];

const Grid = () => {
  const [rows, setRows] = useState(defaultRows); 
  const [cols, setCols] = useState(defaultCols);

  const [notes, setNotes] = useState ({ });

  const newNote = (text, rowIndex, colIndex) => {
    const creationDate = Date.now();
    const id = `note-${creationDate}-${Math.random().toString(36).substr(2, 9)}`;
    const textWithHeaderTags = addTagsToText(text, rows[rowIndex].tags.concat(cols[colIndex].tags));
    const note = { id: id, createDate: creationDate, text: textWithHeaderTags, order: 0 };
  
    setNotes((prevNotes) => {
      return { ...prevNotes, [id]: note };
    });
  
    return note;
  };

  const compareNotes = (note1, note2) => {
    return note1.order - note2.order;
  };

  const findNotesByRowCol = (notes, rowIndex, colIndex) => {
    const cellTags = getTagsByRowCol(rowIndex, colIndex);

    // Convert dictionary (object) values into an array
    const notesArray = Object.values(notes);
    
    return notesArray.filter(note => {
      const noteTags = extractTagsSet(note.text);
      return cellTags.every(tag => noteTags.has(tag));
    }).sort(compareNotes);
  };

  const placeNotesInCell = (noteInstances, cellId, targetIndex) => {
    const [rowIndex, colIndex] = cellIdToRowCol(cellId);
    
    setNotes((prevNotes) => {
      let newNotes = { ...prevNotes }; // Ensure immutability
  
      const cellNotes = findNotesByRowCol(prevNotes, rowIndex, colIndex);
      
      const draggedNoteIds = new Set(
          noteInstances
            .filter(noteInst => noteInst.rowIndex === rowIndex && noteInst.colIndex === colIndex)
            .map(noteInst => noteInst.noteId)
      );

      // Compute placement bounds
      const { afterIndex, beforeIndex, numOtherNotesInCell } = computePlacementBounds(
        cellNotes, draggedNoteIds, targetIndex
      );

      // Compute new order range
      const { insertOrderFrom, deltaIndices } = computeInsertOrder(
        cellNotes, noteInstances.length, afterIndex, beforeIndex, numOtherNotesInCell
      );

      let newInstances = [];

      const destTags = getTagsByCellId(cellId);
      noteInstances.forEach((instance, idx) => {
        const noteId = instance.noteId;
        let note = { ...newNotes[noteId] };

        // Remove old tags and apply new tags
        const sourceTags = getTagsByRowCol(instance.rowIndex, instance.colIndex) || [];
        let text = removeTagsFromText(note.text, sourceTags);
        note.text = addTagsToText(text, destTags);

        // Assign new fractional order
        note.order = insertOrderFrom + (idx + 1) * deltaIndices;
        
        // Store the modified note
        newNotes[noteId] = note;

        // Collect for selection update
        newInstances.push({ noteId, rowIndex, colIndex });
      });

      setSelection(newInstances);
      return newNotes;
    });
  };

  // Helper function to compute placement bounds
  const computePlacementBounds = (cellNotes, draggedNoteIds, targetIndex) => {
    let afterIndex = null, beforeIndex = null;
    let numOtherNotesInCell = 0;

    cellNotes.forEach((note, idx) => {
        if (draggedNoteIds.has(note.id)) return; // Ignore dragged notes
        if (idx < targetIndex) afterIndex = idx;
        if (beforeIndex === null && idx >= targetIndex) beforeIndex = idx;
        numOtherNotesInCell++;
    });

    return { afterIndex, beforeIndex, numOtherNotesInCell };
  };

  // Helper function to compute new ordering range
  const computeInsertOrder = (cellNotes, numDraggedNotes, afterIndex, beforeIndex, numOtherNotesInCell) => {
    const insertOrderFrom = (numOtherNotesInCell === 0) 
        ? -1 
        : afterIndex === null 
            ? cellNotes[beforeIndex].order - numDraggedNotes - 1 
            : cellNotes[afterIndex].order;

    const insertOrderTo = (numOtherNotesInCell === 0) 
        ? numDraggedNotes + 1 
        : beforeIndex === null 
            ? cellNotes[afterIndex].order + numDraggedNotes + 1 
            : cellNotes[beforeIndex].order;

    const deltaIndices = (insertOrderTo - insertOrderFrom) / (numDraggedNotes + 1);
    
    return { insertOrderFrom, deltaIndices };
  };


  const { show, hideAll } = useContextMenu({
    id: "menuId",
    props: {
      key: "value"
    }
  });

  function handleHeaderContextMenu(event, rowIndex, colIndex){
    if (rowIndex < 1 && colIndex <1) return;

    event.preventDefault()
      show({
        event,
        id: rowIndex === 0 ? MENU_ID_COLUMN : MENU_ID_ROW
      })
    
    setContextMenuTarget({rowIndex: rowIndex, colIndex: colIndex})
  }

  const [editingNote, setEditingNote] = useState({rowIndex: null, colIndex: null, noteId: null});
  const [editText, setEditText] = useState("");
  const [editingHeader, setEditingHeader] = useState({rowIndex: null, colIndex: null});
  const [headerText, setHeaderText] = useState("");
  const [contextMenuTarget, setContextMenuTarget] = useState({rowIndex: null, colIndex: null});

  const [selection, setSelection] = useState([])
  const [draggedNoteInst, setDraggedNoteInst] = useState("")
  const [colWidths, setColWidths] = useState(cols.map(() => 150)); // Default width

  /*
  useEffect(() => {
    console.log("ABC Selection changed:", selection);
  }, [selection]);

  useEffect(() => {
    console.log("BBB notes changed:", notes);
  }, [notes]);
  */

  const onDragStart = (item) => {
    setDraggedNoteInst(item.draggableId);
    const noteId = item.draggableId.split(" ")[0];
    setSelection((prev) => {
      const [rowIndex, colIndex] = cellIdToRowCol(item.source.droppableId);
      if (!isNoteInArray(prev, noteId, rowIndex, colIndex)) {
        const selectedNote = {noteId: noteId, rowIndex: rowIndex, colIndex: colIndex}
        return [selectedNote];
      }
      return prev;
    })
  }

  const getCellId = (i, j) => `${i};${j}`;

  const cellIdToRowCol = (cellId) => {
    return cellId.split(';').map(Number);
  }

  const getTagsByRowCol = (rowIndex, colIndex) => {
    return concatTags(rows[rowIndex].tags || [], cols[colIndex].tags || [])
  }

  const getTagsByCellId = (cellId) => {
    const [rowIndex, colIndex] = cellIdToRowCol(cellId)
    return getTagsByRowCol(rowIndex, colIndex)
  }

  const onDragEnd = (result) => {
    if (!result.destination) {
      setDraggedNoteInst("")
      return;
    }

    placeNotesInCell(selection, result.destination.droppableId, result.destination.index);
    setDraggedNoteInst("")
  };

  const textareaRef = useRef(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = ""; // Reset height
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"; // Set new height
    }
  }, [editingNote, editText]); // Runs when editing state or text content changes

  const handleNoteCellDoubleClick = (rowIndex, colIndex) => {
    const newNoteObj = newNote("", rowIndex, colIndex);
    setEditingNote({rowIndex: rowIndex, colIndex: colIndex, noteId: newNoteObj.id});
    setEditText("");
  };

  const handleHeaderDoubleClick = (rowIndex, colIndex, isRow) => {
    if (isRow) {
      setEditingHeader({ rowIndex: rowIndex, colIndex: null });
      setHeaderText(rows[rowIndex].title);
    } else {
      setEditingHeader({ rowIndex: null, colIndex: colIndex });
      setHeaderText(cols[colIndex].title);
    }
  };

  const handleHeaderChange = (e) => {
    setHeaderText(e.target.value);
  };
  
  const handleHeaderBlur = () => {
    if (editingHeader.rowIndex !== null) {
        // Save edited row header
        const updatedRows = [...rows];
        const [title, tags] = extractTagsOrGenerateNew(headerText, 'row_')
        updatedRows[editingHeader.rowIndex].title = title;
        updatedRows[editingHeader.rowIndex].tags = tags;
        setRows(updatedRows);
    } else if (editingHeader.colIndex !== null) {
        // Save edited column header
        const updatedCols = [...cols];
        const [title, tags] = extractTagsOrGenerateNew(headerText, 'col_')
        updatedCols[editingHeader.colIndex].title = title;
        updatedCols[editingHeader.colIndex].tags = tags;
        setCols(updatedCols);
    }
    setEditingHeader({ row: null, col: null });
  };

  const handleHeaderKeyDown = (e) => {
    if (e.key === "Escape" || e.key === "Enter") {
      handleHeaderBlur(); // Save and exit edit mode
    }
  };
  
  const handleNoteDoubleClick = (note, rowIndex, colIndex) => {
    setEditingNote({rowIndex: rowIndex, colIndex: colIndex, noteId: note.id});
    const tags = rows[rowIndex].tags.concat(cols[colIndex].tags);
    setEditText(removeTagsFromText(note.text, tags));
  };

  const handleNoteClick = (note, rowIndex, colIndex, event) => {    
    const isCtrlPressed = event.ctrlKey || event.metaKey; // Detect Ctrl (Windows/Linux) or Cmd (Mac)
    const selectedNote = {rowIndex: rowIndex, colIndex: colIndex, noteId: note.id}
    setSelection((prevSelection) => {
      if (isCtrlPressed) {
        // Toggle selection without overriding previous selection
        return isNoteInArray(prevSelection, note.id, rowIndex, colIndex)
          ? removeNoteFromArray(prevSelection, note, rowIndex, colIndex) // Deselect if already selected
          : [...prevSelection, selectedNote]; // Add to selection
      } else {
        // Single selection mode (no Ctrl)
        return isNoteInArray(prevSelection, selectedNote.id, rowIndex, colIndex) ? [] : [selectedNote];
      }
    });
  };

  const handleChange = (e) => {
    setEditText(e.target.value);
  };

  const handleBlur = () => {
    if (editingNote.noteId) {
      if (editText.trim() === "") {
        // Remove the note if it's empty
        setNotes((prevNotes) => {
          const newNotes = { ...prevNotes }; // Create a shallow copy
          delete newNotes[editingNote.noteId]; // Remove the note safely
          return newNotes; // Return the updated object
        });
      } else {
        const textWithHeaderTags = addTagsToText(editText, rows[editingNote.rowIndex].tags.concat(cols[editingNote.colIndex].tags));
        setNotes((prevNotes) => ({
          ...prevNotes,
          [editingNote.noteId]: {
            ...prevNotes[editingNote.noteId], // Keep other properties of the note unchanged
            text: textWithHeaderTags, // Update the text
          },
        }));
      }
      setEditingNote({rowIndex: null, colIndex: null, noteId: null});
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleBlur();
    } else if (e.key === "Enter" && e.ctrlKey) {
      handleBlur(); // Save and exit edit mode
    }
  };
  /// Save to JSON (including headers)
  const saveToJSON = () => {
    const data = {
      rows: rows,  // Include the row names
      cols: cols,  // Include the column names
      notes: notes, // Include the note data
    };

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notes.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Load from JSON (including headers)
  const loadFromJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loadedData = JSON.parse(reader.result);
        setRows(loadedData.rows);  // Restore the row headers
        setCols(loadedData.cols);  // Restore the column headers
        setNotes(loadedData.notes);  // Restore the notes
      } catch (error) {
        console.error('Error loading JSON:', error);
        alert('Failed to load JSON. Please make sure the file is valid.');
      }
    };
    reader.readAsText(file);
  };

  // Add a new row
  const addRow = (index) => {
    setRows((prevRows) => {
        const newRows = [...prevRows];
        newRows.splice(index, 0, newHeader("")); // Insert the new column at the given index
        return newRows;
      }
    );

    setEditingHeader({ rowIndex: index, colIndex: null });
    setHeaderText("");
  }
  
  // Add a new column
  const addColumn = (index) => {
    setCols((prevCols) => {
        const newCols = [...prevCols];
        newCols.splice(index, 0, newHeader("")); // Insert the new column at the given index
        return newCols;
      }
    );

    setEditingHeader({ rowIndex: null, colIndex: index });
    setHeaderText("");
  };

  // Todo - now deleting rows and columns isn't so harmful .. still need this?
  function isRowDeleteDisabled(rowIndex) {
    if (rowIndex < 1 || rows.length < 5) return true;

    return false;
    //const rowKeyPrefix = `${rows[rowIndex].id};`;
    //const rowlHasNotes = Object.keys(notesState.cells).some(
    //  key => key.startsWith(rowKeyPrefix) && notesState.cells[key].length > 0
    //);
    //return rowlHasNotes;
  }  

  function isColumnDeleteDisabled(colIndex) {
    if (colIndex < 1  || cols.length < 5) return true;
    return false;
    //const colKeySuffix = `;${cols[colIndex].id}`;
    //const colHasNotes = Object.keys(notesState.cells).some(
    //  key => key.endsWith(colKeySuffix) && notesState.cells[key].length > 0
    //);
    //return colHasNotes;
  }

  // Remove Row
  const removeRow = (rowIndex) => {
    setRows((prevRows) => prevRows.filter((_, i) => i !== rowIndex));
  };
  
  // Remove Column
  const removeColumn = (colIndex) => {
    setCols((prevColumns) => prevColumns.filter((_, i) => i !== colIndex));
  };

  const handleColResizeMouseDown = (e, index) => {
    const startX = e.clientX;
    const startWidth = colWidths[index];

    const handleMouseMove = (moveEvent) => {
        const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
        setColWidths((prev) => prev.map((w, i) => (i === index ? newWidth : w)));
    };

    const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const ColumnHeader = (colText, colIndex) => {
    const cellKey = getCellId(0, colIndex);
    const isEditing = editingHeader.colIndex === colIndex;
    const position = isEditing ? "relative" : "sticky";
    return (
      <div
        className="column-header-cell"
        onDoubleClick={() => handleHeaderDoubleClick(0, colIndex, false)}
        onContextMenu={(event) => handleHeaderContextMenu(event, 0, colIndex)}
        key={cellKey}
        style={{ position: `${position}`, width: `${colWidths[colIndex]}px` }}
      >
        {isEditing ? (
          <input
            value={headerText}
            onChange={handleHeaderChange}
            onBlur={handleHeaderBlur}
            onKeyDown={handleHeaderKeyDown}
            style={{position:"absolute", minWidth:"200px", zIndex:"1"}}
            autoFocus
          />
        ) : (
          <>
            {colText}
            <div className="col-resize-handle" onMouseDown={(e) => handleColResizeMouseDown(e, colIndex)} />
          </>
        )}

        <Menu id={MENU_ID_COLUMN}>
          <Item id="insert_col_left" onClick={() => addColumn(contextMenuTarget.colIndex)}>Insert column to left</Item>
          <Item id="insert_col_right" onClick={() => addColumn(contextMenuTarget.colIndex+1)}>Insert column to right</Item>
          <Separator />
          <Item id="delete" disabled={() => isColumnDeleteDisabled(contextMenuTarget.colIndex)} onClick={() => removeColumn(contextMenuTarget.colIndex)}>Delete</Item>
        </Menu>
      </div>
    );
  };

  const RowHeader = (rowText, rowIndex) => {
    const isEditing = editingHeader.rowIndex === rowIndex;
    const position = isEditing ? "relative" : "sticky";
    return (
      <div
        className="row-header-cell"
        onDoubleClick={() => handleHeaderDoubleClick(rowIndex, 0, true)}
        onContextMenu={(event) => handleHeaderContextMenu(event, rowIndex, 0)}
        key={`row_header_${rowIndex}`}
        style={{position:`${position}`, minHeight:"20px"}}
      >
        {isEditing ? (
          <input
            value={headerText}
            onChange={handleHeaderChange}
            onBlur={handleHeaderBlur}
            onKeyDown={handleHeaderKeyDown}
            style={{position:"absolute", zIndex:"1", minWidth:"200px"}}
            autoFocus
          />
        ) : (
          rowText
        )}
      
        
        <Menu id={MENU_ID_ROW}>
          <Item id="insert_row_above" onClick={() => addRow(contextMenuTarget.rowIndex)}>Insert row above</Item>
          <Item id="insert_row_below" onClick={() => addRow(contextMenuTarget.rowIndex+1)}>Insert row below</Item>
          <Separator />
          <Item id="delete" disabled={() => isRowDeleteDisabled(contextMenuTarget.rowIndex)} onClick={() => removeRow(contextMenuTarget.colIndex)}>Delete</Item>
        </Menu>
        
      </div>
    );
  };

  function isNoteInArray(array, noteId, rowIndex, colIndex) {
    const result = array.some(obj =>
      obj.rowIndex === rowIndex &&
      obj.colIndex === colIndex &&
      obj.noteId === noteId
    );
    return result;
  }

  function removeNoteFromArray(array, note, rowIndex, colIndex) {
    const result = array.filter(obj =>
      obj.rowIndex !== rowIndex ||
      obj.colIndex !== colIndex ||
      obj.noteId !== note.id
    );
    return result;
  }

  function isAnotherNoteInstanceSelected(note, rowIndex, colIndex) {    
    const result = selection.some(obj =>
      (obj.rowIndex !== rowIndex ||
      obj.colIndex !== colIndex) &&
      obj.noteId === note.id
    );
  
    return result;
  }


  function handleNoteContextMenu(event, noteId){
    event.preventDefault()
    show({
      event,
      id: MENU_ID_NOTE
    })
    setContextMenuTarget(noteId)
  }

  const NoteUI = (note, rowIndex, colIndex, draggableId) => {
    const isDragged = (draggableId === draggedNoteInst);
    const isSelected = isNoteInArray(selection, note.id, rowIndex, colIndex);
    const style = isDragged ? {outline: "2px solid blue", outlineOffset: "0px"}  
                  : isSelected ? {outline: "1px solid blue", outlineOffset: "-1px"}  
                  : isAnotherNoteInstanceSelected(note, rowIndex, colIndex) ?
                    {outline: "1px dashed blue", outlineOffset: "-1px"}
                  : {border : "0px"};
    const selectedCount = draggedNoteInst ? selection.length : 0;
  
    if (draggedNoteInst && !isDragged && isSelected) {
      style.outline = "0px";
      style.opacity = 0.5
    }
    
    const isEditing = (note.id === editingNote.noteId) && (rowIndex === editingNote.rowIndex) && (colIndex === editingNote.colIndex);
    const tags = concatTags(extractTags((isEditing ? editText : note.text)), rows[rowIndex].tags, cols[colIndex].tags);
    const displayText = isEditing ? note.text : removeAllTagsFromText(note.text);

    if (tags.includes("#todo")) {
      style.backgroundColor = "lightgreen"
    } else if (tags.includes("#fyi")) {
      style.backgroundColor = "white"
    }

    return (
      <div>
        {(draggedNoteInst === draggableId && (selectedCount > 1)) ? (<div className="drag-count">{selectedCount}</div>) : (<></>)}
        <div
          className="note"
          onDoubleClick={(e) => {
            e.stopPropagation(); // Prevent triggering cell's double-click
            handleNoteDoubleClick(note, rowIndex, colIndex);
          } }
          onClick={(e) => {
            e.stopPropagation();
            if (note.id !== editingNote.noteId || rowIndex !== editingNote.rowIndex || colIndex !== editingNote.colIndex)  {
              handleBlur();
              handleNoteClick(note, rowIndex, colIndex, e);
            }
          } }
          style={style}
          onContextMenu={(event) => {if (!isEditing) {handleNoteContextMenu(event, note.id)}}}  
        >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            type="text"
            value={editText}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{position:"relative", minWidth:"300px"}}
            autoFocus />
        ) : (
          <ReactMarkdown children={displayText} remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeRaw, rehypeKatex]} 
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
      
                return !inline && match ? (
                  <SyntaxHighlighter style={dracula} PreTag="div" language={match[1]} {...props}>
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
            autofocus/>
        )}
        {isEditing && tags.length > 0 ? 
            (<div style={{ color: "#555", marginLeft: "0px", wordwrap:"break-word", fontSize:10 }}>tags: {tags.join(" ")}</div>)
            : (<></>)
        }
      </div>
    </div>);
  }

  const NotesCell = (rowIndex, colIndex) => {
    const cellId = getCellId(rowIndex, colIndex);
    const cellNotes = findNotesByRowCol(notes, rowIndex, colIndex);

    return (
      <Droppable key={cellId} droppableId={cellId}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="droppable-cell"
            onDoubleClick={() => handleNoteCellDoubleClick(rowIndex, colIndex)}
            onClick={() => { setSelection([]); }}
            key={cellId}
            style={{ width: `${colWidths[colIndex]}px`}}
          >
            { 
              cellNotes.map((note, index) => {
                const draggableId = `${note.id} ${cellId}`;
                return (
                  <Draggable key={note.id} draggableId={draggableId} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        {NoteUI(note, rowIndex, colIndex, draggableId)}
                      </div>
                    )}
                  </Draggable>
                );
              })
            }
            {provided.placeholder}
          </div>
        )}
      </Droppable>)
  };

  return (
    <div>
      <button onClick={saveToJSON}>Save Notes</button>
      <input
        type="file"
        accept=".json"
        onChange={(e) => loadFromJSON(e.target.files[0])}
      />

      <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}> {
        <div
          className="grid-container"
          style={{ gridTemplateColumns: `repeat(${cols.length}, max-content)` }}
        >
          {rows.map((row, rowIndex) =>
            cols.map((col, colIndex) => { 
              if (rowIndex === 0) return ColumnHeader(removeAllTagsFromText(col.title), colIndex);
              if (colIndex === 0) return RowHeader(removeAllTagsFromText(row.title), rowIndex);
              return NotesCell(rowIndex, colIndex);
            })
          )}
        </div>
      }
      </DragDropContext>
      
      <Menu id={MENU_ID_NOTE}>
          
        <Separator></Separator>
      </Menu>
    </div>
  );
};

export default Grid;
