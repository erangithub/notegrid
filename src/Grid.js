import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Menu, Item, Separator, Submenu, useContextMenu } from 'react-contexify';
import 'react-contexify/ReactContexify.css';
import './Grid.css';

const MENU_ID_COLUMN = 'menu_col';
const MENU_ID_ROW = 'menu_row';

const Grid = () => {
  const [rows, setRows] = useState(["", "Todo", "People", "Topic 1", "Topic 2"]);
  const [cols, setCols] = useState(["", "Alice", "Bob", "Charlie", "Diana"]);

  const [notesState, setNotesState] = useState ( {notes: { }, cells: {} });

  const getCellId = (row, col) => `${row}-${col}`;

  const newNote = (text, cellId) => {
    const creationDate = Date.now();
    const id = `note-${creationDate}-${Math.random().toString(36).substr(2, 9)}`;
    const note = { id, creationDate, text, parentId: cellId };
  
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

  function handleContextMenu(event, rowIndex, colIndex){
    console.log("handleContextMenu", rowIndex, colIndex)
    event.preventDefault()
      show({
        event,
        id: rowIndex == 0 ? MENU_ID_COLUMN : MENU_ID_ROW
      })
    
    setTarget({row: rowIndex, col: colIndex})
  }

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editingHeader, setEditingHeader] = useState({ row: null, col: null });
  const [headerText, setHeaderText] = useState("");
  const [target, setTarget] = useState({row: null, col: null});

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
      setEditingHeader({ row: rowIndex, col: null });
      setHeaderText(rows[rowIndex]);
    } else {
      setEditingHeader({ row: null, col: colIndex });
      setHeaderText(cols[colIndex]);
    }
  };

  const handleHeaderChange = (e) => {
    setHeaderText(e.target.value);
  };
  
  const handleHeaderBlur = () => {
    if (editingHeader.row !== null) {
      // Save edited row header
      const updatedRows = [...rows];
      updatedRows[editingHeader.row] = headerText;
      setRows(updatedRows);
    } else if (editingHeader.col !== null) {
      // Save edited column header
      const updatedCols = [...cols];
      updatedCols[editingHeader.col] = headerText;
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
    console.log("addRow", index);
    
    const newRows = [...rows];
    newRows.splice(index, 0, ""); // Insert the new column at the given index
    setRows(newRows);

    // Shift existing notes first
    const updatedNotes = {};
    Object.keys(notesState).forEach((key) => {
        const [row, col] = key.split("-").map(Number);
        if (row >= index) {
            updatedNotes[getCellId(row+1, col)] = notesState[key]; // Shift right
        } else {
            updatedNotes[key] = notesState[key]; // Keep as is
        }
    });

    // Now initialize empty cells for the new row
    rows.forEach((colIndex, _) => {
        const newCellKey = getCellId(index, colIndex);
        updatedNotes[newCellKey] = []; // Add empty cell at the new column
    });

    // TODO
    //setNotes(updatedNotes);
    setEditingHeader({ row: index, col: null });
    setHeaderText("");
  };

  // Add a new column
  const addColumn = (index) => {
    console.log("addColumn", index);
    
    const newCols = [...cols];
    newCols.splice(index, 0, ""); // Insert the new column at the given index
    setCols(newCols);

    // Shift existing notes first
    const updatedNotes = {};
    Object.keys(notesState).forEach((key) => {
        const [row, col] = key.split("-").map(Number);
        if (col >= index) {
            updatedNotes[getCellId(row, col+1)] = notesState[key]; // Shift right
        } else {
            updatedNotes[key] = notesState[key]; // Keep as is
        }
    });

    // Now initialize empty cells for the new column
    rows.forEach((_, rowIndex) => {
        const newCellKey = getCellId(rowIndex, index);
        updatedNotes[newCellKey] = []; // Add empty cell at the new column
    });

    // TODO
    //setNotes(updatedNotes);
    setEditingHeader({ row: null, col: index });
    setHeaderText("");
  };

  function isRowDeleteDisabled(rowIndex) {
    console.log(rowIndex)
    const rowKeyPrefix = `${rowIndex}-`;
    const rowlHasNotes = Object.keys(notesState).some(
      key => key.startsWith(rowKeyPrefix) && notesState[key].length > 0
    );
    return rowlHasNotes;
  }  

  // Remove Row
  const removeRow = (rowIndex) => {
    const rowKeyPrefix = `${rowIndex}-`;
    const rowHasNotes = Object.keys(notesState).some(key => key.startsWith(rowKeyPrefix) && notesState[key].length > 0);

    if (!rowHasNotes) {
      const newRows = rows.filter((_, index) => index !== rowIndex);
      const newNotes = Object.fromEntries(
        Object.entries(notesState).filter(([key]) => !key.startsWith(rowKeyPrefix))
      );
      setRows(newRows);
      //TODO
      //setNotes(newNotes);
    } else {
      alert("Cannot remove row with notes.");
    }
  };

  function isColumnDeleteDisabled(colIndex) {
    console.log(colIndex)
    const colKeyPrefix = `-${colIndex}`;
    const colHasNotes = Object.keys(notesState).some(
      key => key.endsWith(colKeyPrefix) && notesState[key].length > 0
    );
    return colHasNotes;
  }

  // Remove Column
  const removeColumn = (colIndex) => {
    const colKeyPrefix = `-${colIndex}`;
    const colHasNotes = Object.keys(notesState).some(
      key => key.endsWith(colKeyPrefix) && notesState[key].length > 0
    );
  
    if (!colHasNotes) {
      // Remove column from `cols` array
      const newCols = cols.filter((_, index) => index !== colIndex);
  
      // Create a new notes object with shifted keys
      const updatedNotes = {};
      Object.entries(notesState).forEach(([key, value]) => {
        const [row, col] = key.split("-").map(Number);
  
        if (col < colIndex) {
          // Keep notes in columns before the deleted column
          updatedNotes[key] = value;
        } else if (col > colIndex) {
          // Shift columns after the deleted one to the left
          updatedNotes[getCellId(row, col-1)] = value;
        }
      });
  
      //TODO
      //setNotes(updatedNotes);
      setCols(newCols);
    } else {
      alert("Cannot remove column with notes.");
    }
  };
  
  const ColumnHeader = (colText, colIndex) => {
    return (
      <div
        className="column-header-cell"
        onDoubleClick={() => handleHeaderDoubleClick(0, colIndex, false)}
        onContextMenu={(event) => handleContextMenu(event, 0, colIndex)}
        key={`col_header${colIndex}`}
      >
        {editingHeader.col === colIndex ? (
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
          <Item id="insert_col_left" onClick={() => addColumn(target.col)}>Insert column to left</Item>
          <Item id="insert_col_right" onClick={() => addColumn(target.col+1)}>Insert column to right</Item>
          <Separator />
          <Item id="delete" disabled={() => isColumnDeleteDisabled(target.col)} onClick={() => removeColumn(target.col)}>Delete</Item>
        </Menu>
      </div>
    );
  };

  const RowHeader = (rowText, rowIndex) => {
    return (
      <div
        className="row-header-cell"
        onDoubleClick={() => handleHeaderDoubleClick(rowIndex, 0, true)}
        onContextMenu={(event) => handleContextMenu(event, rowIndex, 0)}
        key={`row_header_${rowIndex}`}
      >
        {editingHeader.row === rowIndex ? (
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
          <Item id="insert_row_above" onClick={() => addRow(target.row)}>Insert row above</Item>
          <Item id="insert_row_below" onClick={() => addRow(target.row+1)}>Insert row below</Item>
          <Separator />
          <Item id="delete" disabled={() => isRowDeleteDisabled(target.row)} onClick={() => removeRow(target.col)}>Delete</Item>
        </Menu>
        
      </div>
    );
  };

  function isNoteSelected(note) {
    return selection.includes(note.id);
  }

  const NoteUI = (note) => {
    const style = isNoteSelected(note) ? {outline: "1px solid blue", outlineOffset: "-1px"}  : {border : "0px"};
    const selectedCount = draggedNote ? selection.length : 0;
  
    if (draggedNote && isNoteSelected(note) && (note.id != draggedNote)) {
      style.outline = "0px";
      style.opacity = 0.5
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
        style = {style}
      >
        {editingNoteId === note.id ? (
          <textarea
            ref={textareaRef}
            type="text"
            value={editText}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus />
        ) : (
          <ReactMarkdown>{note.text}</ReactMarkdown>
        )}
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
              if (rowIndex === 0) return ColumnHeader(col, colIndex);
              if (colIndex === 0) return RowHeader(row, rowIndex);
              return NotesCell(rowIndex, colIndex);
              
            })
          )}
        </div>
      }
      </DragDropContext>
    </div>
  );
};

export default Grid;
