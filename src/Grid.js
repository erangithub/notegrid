import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Menu, Item, Separator, Submenu, useContextMenu } from 'react-contexify';
import 'react-contexify/ReactContexify.css';
import './Grid.css';

const MENU_ID_COLUMN = 'menu_col';
const MENU_ID_ROW = 'menu_row';
const MENU_ID_NOTE = 'menu_note';

const Grid = () => {
  const newHeader = ((title) => {
    const id = `${Math.random().toString(36).substr(2, 9)}`
    return {id : id, title: title}
  });

  const [rows, setRows] = useState([newHeader(""), newHeader("1"), newHeader("2"), newHeader("3")]); 
  const [cols, setCols] = useState([newHeader(""), newHeader("a"), newHeader("b"), newHeader("c")]);

  const [notesState, setNotesState] = useState ( {notes: { }, cells: {} });

  const getCellId = (i, j) => `${rows[i].id};${cols[j].id}`;

  const newNote = (text, cellId) => {
    const creationDate = Date.now();
    const id = `note-${creationDate}-${Math.random().toString(36).substr(2, 9)}`;
    const note = { id: id, createDate: creationDate, text: text, parentId: cellId };
  
    // Updating the notes and cells state together
    setNotesState((prevNotes) => {
      const newNotes = { ...prevNotes.notes, [id]: note };
  
      // Update cells with the new note
      const newCells = {
        ...prevNotes.cells,
        [cellId]: [...(prevNotes.cells[cellId] || []), id], // Add the note to the specified cell
      };
  
      console.log("newNotes", newNotes);

      return {
        notes: newNotes,
        cells: newCells,
      };
    });
  
    
    return note;
  };

  const placeNotesInCell = (noteIds, cellId, index = undefined) => {
    setNotesState((prevNotes) => {
      var { notes, cells } = prevNotes;
      for (let idx = noteIds.length-1; idx >= 0; idx--) {
        const noteId = noteIds[idx];

        var note = notes[noteId];

        // Get the current notes in the parent cell
        const prevCellId = note.parentId;
        const prevCellNotes = (cells[prevCellId] || []);
        console.log("prevCellNotes", noteId, notes, cells);
        
        const oldIndex = prevCellNotes.length ? prevCellNotes.indexOf(noteId) : -1;
        console.log("oldIndex", oldIndex);
    
        // Step 1: Remove from old cell (if it exists)
        const updatedOldCellNotes = [...prevCellNotes];
        
        console.log("updatedOldCellNotes", updatedOldCellNotes)
        if (oldIndex !== -1) updatedOldCellNotes.splice(oldIndex, 1);
        console.log("updatedOldCellNotes", prevCellId, updatedOldCellNotes)
        // If cellId is undefined, we're just removing the note
        if (!cellId) {
          return {
            ...prevNotes,
            cells: {
              ...cells,
              [prevCellId]: updatedOldCellNotes,
            },
          };
        }

        // Step 2: Add to new cell
        const newCellNotes = prevCellId === cellId ? updatedOldCellNotes : [...(cells[cellId] || [])];
        const insertIndex = index !== undefined ? index : newCellNotes.length;
        newCellNotes.splice(insertIndex, 0, note.id);
    
        // Step 3: Update the parentId of the note (after moving it)
        console.log("cellid", cellId)
        
        note.parentId = cellId;
        cells = {
          ...cells,
          [prevCellId]: updatedOldCellNotes,
          [cellId]: newCellNotes, 
        };
        notes = {
          ...notes,
          [note.id]: note, // Update the note’s parentId in the notes state
        };
      };
      return {
        ...prevNotes,
        cells: cells,
        notes: notes
      };
    });
  };

  const { show, hideAll } = useContextMenu({
    id: "menuId",
    props: {
      key: "value"
    }
  });

  function handleHeaderContextMenu(event, rowIndex, colIndex){
    if (rowIndex < 1 && colIndex <1) return;
    console.log("handleContextMenu", rowIndex, colIndex)
    event.preventDefault()
      show({
        event,
        id: rowIndex == 0 ? MENU_ID_COLUMN : MENU_ID_ROW
      })
    
    setContextMenuTarget({rowIndex: rowIndex, colIndex: colIndex})
  }

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editingHeader, setEditingHeader] = useState({rowIndex: null, colIndex: null});
  const [headerText, setHeaderText] = useState("");
  const [contextMenuTarget, setContextMenuTarget] = useState({rowIndex: null, colIndex: null});

  const [selection, setSelection] = useState([])
  const [draggedNote, setDraggedNote] = useState("")

  const onDragStart = (item) => {
    console.log("Item", item);
    setDraggedNote(item.draggableId);
  }

  const onDragEnd = (result) => {
    setDraggedNote("")
    if (!result.destination) return;

    const { source, destination } = result;
    
    if (selection.length) {
      placeNotesInCell(selection, destination.droppableId, destination.index);
    } else {
      placeNotesInCell([draggedNote], destination.droppableId, destination.index);
    }
    setSelection([]);
  };

  const textareaRef = useRef(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = ""; // Reset height
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"; // Set new height
    }
  }, [editingNoteId, editText]); // Runs when editing state or text content changes

  const handleDoubleClick = (cellKey) => {
    const newNoteObj = newNote("", cellKey);
    setEditingNoteId(newNoteObj.id);
    setEditText(newNoteObj.text);
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
        updatedRows[editingHeader.rowIndex].title = headerText;
        setRows(updatedRows);
    } else if (editingHeader.colIndex !== null) {
        // Save edited column header
        const updatedCols = [...cols];
        updatedCols[editingHeader.colIndex].title = headerText;
        setCols(updatedCols);
    }
    setEditingHeader({ row: null, col: null });
  };

  const handleHeaderKeyDown = (e) => {
    if (e.key === "Escape" || e.key === "Enter") {
      handleHeaderBlur(); // Save and exit edit mode
    }
  };
  
  const handleNoteDoubleClick = (note) => {
    setEditingNoteId(note.id);
    setEditText(note.text);
  };

  const handleNoteClick = (note, event) => {    
    const isCtrlPressed = event.ctrlKey || event.metaKey; // Detect Ctrl (Windows/Linux) or Cmd (Mac)
    
    setSelection((prevSelection) => {
      if (isCtrlPressed) {
        // Toggle selection without overriding previous selection
        return prevSelection.includes(note.id)
          ? prevSelection.filter(id => id !== note.id) // Deselect if already selected
          : [...prevSelection, note.id]; // Add to selection
      } else {
        // Single selection mode (no Ctrl)
        return prevSelection.includes(note.id) ? [] : [note.id];
      }
    });
  };

  const handleChange = (e) => {
    setEditText(e.target.value);
  };

  const handleBlur = () => {
    if (editingNoteId) {
      if (editText.trim() === "") {
        // Remove the note if it's empty
        placeNotesInCell([editingNoteId], null);
      } else {
        setNotesState((prevNotes) => ({
          ...prevNotes,
          notes: {
            ...prevNotes.notes,
            [editingNoteId]: {
              ...prevNotes.notes[editingNoteId], // Keep other properties of the note unchanged
              text: editText, // Update the text
            },
          }
        }));
      }
      setEditingNoteId(null);
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
      notes: notesState, // Include the note data
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
        setNotesState(loadedData.notes);  // Restore the notes
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
        newRows.splice(index, 0, newHeader()); // Insert the new column at the given index
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
        newCols.splice(index, 0, newHeader()); // Insert the new column at the given index
        return newCols;
      }
    );

    setEditingHeader({ rowIndex: null, colIndex: index });
    setHeaderText("");
  };

  function isRowDeleteDisabled(rowIndex) {
    if (rowIndex < 1 || rows.length < 5) return true;

    const rowKeyPrefix = `${rows[rowIndex].id};`;
    const rowlHasNotes = Object.keys(notesState.cells).some(
      key => key.startsWith(rowKeyPrefix) && notesState.cells[key].length > 0
    );
    return rowlHasNotes;
  }  

  function isColumnDeleteDisabled(colIndex) {
    console.log(colIndex)
    if (colIndex < 1  || cols.length < 5) return true;
    const colKeySuffix = `;${cols[colIndex].id}`;
    const colHasNotes = Object.keys(notesState.cells).some(
      key => key.endsWith(colKeySuffix) && notesState.cells[key].length > 0
    );
    return colHasNotes;
  }

  // Remove Row
  const removeRow = (rowIndex) => {
    setRows((prevRows) => prevRows.filter((_, i) => i !== rowIndex));
  };
  
  // Remove Column
  const removeColumn = (colIndex) => {
    setCols((prevColumns) => prevColumns.filter((_, i) => i !== colIndex));
  };
  
  const ColumnHeader = (colText, colIndex) => {
    return (
      <div
        className="column-header-cell"
        onDoubleClick={() => handleHeaderDoubleClick(0, colIndex, false)}
        onContextMenu={(event) => handleHeaderContextMenu(event, 0, colIndex)}
        key={`col_header${colIndex}`}
      >
        {editingHeader.colIndex === colIndex ? (
          <input
            value={headerText}
            onChange={handleHeaderChange}
            onBlur={handleHeaderBlur}
            onKeyDown={handleHeaderKeyDown}
            autoFocus
          />
        ) : (
          colText
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
    return (
      <div
        className="row-header-cell"
        onDoubleClick={() => handleHeaderDoubleClick(rowIndex, 0, true)}
        onContextMenu={(event) => handleHeaderContextMenu(event, rowIndex, 0)}
        key={`row_header_${rowIndex}`}
      >
        {editingHeader.rowIndex === rowIndex ? (
          <input
            value={headerText}
            onChange={handleHeaderChange}
            onBlur={handleHeaderBlur}
            onKeyDown={handleHeaderKeyDown}
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

  function isNoteSelected(note) {
    return selection.includes(note.id);
  }

  function handleNoteContextMenu(event, noteId){
    event.preventDefault()
    show({
      event,
      id: MENU_ID_NOTE
    })
    setContextMenuTarget(noteId)
  }

  const extractTags = (text) => {
    const tags = Array.from(new Set(text.match(/#\w+/g)) || []); // Extract hashtags and store them in a Set
    console.log(tags)
    return tags
  };
  
  const removeTagsFromText = (text) => {
    return text.replace(/#\w+/g, "").trim(); // Remove hashtags from display
  };

  const NoteUI = (note) => {
    const style = isNoteSelected(note) ? {outline: "1px solid blue", outlineOffset: "-1px"}  : {border : "0px"};
    const selectedCount = draggedNote ? selection.length : 0;
  
    if (draggedNote && isNoteSelected(note) && (note.id != draggedNote)) {
      style.outline = "0px";
      style.opacity = 0.5
    }
    
    
    const isEditing = note.id === editingNoteId;
    const tags = extractTags(isEditing ? editText : note.text);
    const displayText = isEditing ? note.text : removeTagsFromText(note.text);

    if (tags.includes("#todo")) {
      style.backgroundColor = "lightgreen"
    } else if (tags.includes("#fyi")) {
        style.backgroundColor = "white"
    }

    return (
      <div>
        {(draggedNote == note.id && (selectedCount > 1)) ? (<div className="drag-count">{selectedCount}</div>) : (<div/>)}
      <div
        className="note"
        onDoubleClick={(e) => {
          e.stopPropagation(); // Prevent triggering cell's double-click
          handleNoteDoubleClick(note);
        } }
        onClick={(e) => {
          e.stopPropagation();
          if (note.id != editingNoteId) {
            handleBlur();
            handleNoteClick(note, e);
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
            autoFocus />
        ) : (
          <ReactMarkdown>{displayText}</ReactMarkdown>
        )}
        {isEditing && tags.length > 0 ? 
            (<div style={{ color: "#555", marginLeft: "0px", wordwrap:"break-word", fontSize:8 }}>tags: {tags.join(" ")}</div>)
            : (<div/>)
        }
      </div>
      </div>);
    }

  const NotesCell = (rowIndex, colIndex) => {
    const cellKey = getCellId(rowIndex, colIndex);
    return (
      <Droppable key={cellKey} droppableId={cellKey}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="droppable-cell"
            onDoubleClick={() => handleDoubleClick(cellKey)}
            onClick={() => setSelection([])}
            key={cellKey}
          >
            {notesState.cells[cellKey]?.map((noteId, index) => (
              <Draggable key={noteId} draggableId={noteId} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    {NoteUI(notesState.notes[noteId])}
                  </div>
                )}
              </Draggable>
            ))}
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
            cols.map((col, colIndex) => { <div/>
              if (rowIndex === 0) return ColumnHeader(col.title, colIndex);
              if (colIndex === 0) return RowHeader(row.title, rowIndex);
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
