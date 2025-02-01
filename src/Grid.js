import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Menu, Item, Separator, Submenu, useContextMenu } from 'react-contexify';
import 'react-contexify/ReactContexify.css';
import './Grid.css';

const MENU_ID_COLUMN = 'menu_col';
const MENU_ID_ROW = 'menu_row';


const newNote = (text) => {
  const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return { id: id, text: text }
}

const Grid = () => {
  const [rows, setRows] = useState(["", "Todo", "People", "Topic 1", "Topic 2"]);
  const [cols, setCols] = useState(["", "Alice", "Bob", "Charlie", "Diana"]);

  const [notes, setNotes] = useState({
    "1-1": [newNote("Note 1"), newNote("Note 2")],
    "2-3": [newNote("Vacation Note")],
  });

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

  const onDragEnd = (result) => {
    console.log("Drag Result:", result);
    if (!result.destination) return;

    const { source, destination } = result;
    const sourceKey = source.droppableId;
    const destinationKey = destination.droppableId;

    if (sourceKey === destinationKey) {
      const sourceNotes = Array.from(notes[sourceKey]);
      const [removed] = sourceNotes.splice(source.index, 1);
      sourceNotes.splice(destination.index, 0, removed);
      setNotes({ ...notes, [sourceKey]: sourceNotes });
    } else {
      const sourceNotes = Array.from(notes[sourceKey] || []);
      const [removed] = sourceNotes.splice(source.index, 1);
      const destinationNotes = Array.from(notes[destinationKey] || []);

      destinationNotes.splice(destination.index, 0, removed);
      setNotes({
        ...notes,
        [sourceKey]: sourceNotes,
        [destinationKey]: destinationNotes,
      });
    }
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
    const newNoteObj = newNote("");
  
    setNotes((prevNotes) => ({
      ...prevNotes,
      [cellKey]: [...(prevNotes[cellKey] || []), newNoteObj],
    }));
  
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
    if (e.key === "Escape") {
      setEditingHeader({ row: null, col: null }); // Exit edit mode without saving
    } else if (e.key === "Enter" ) {
      handleHeaderBlur(); // Save and exit edit mode
    }
  };
  
  const handleNoteDoubleClick = (note) => {
    setEditingNoteId(note.id);
    setEditText(note.text);
  };

  const handleChange = (e) => {
    setEditText(e.target.value);
  };

  const handleBlur = () => {
    if (editingNoteId) {
      if (editText.trim() === "") {
        // Remove the note if it's empty
        setNotes((prevNotes) => {
          const updatedNotes = { ...prevNotes };
          for (const key in updatedNotes) {
            updatedNotes[key] = updatedNotes[key].filter(note => note.id !== editingNoteId);
            // If the cell has no more notes, remove the key entirely
            if (updatedNotes[key].length === 0) {
              delete updatedNotes[key];
            }
          }
          return updatedNotes;        
        });
      } else {
        setNotes((prevNotes) => {
          const updatedNotes = { ...prevNotes };
          for (const key in updatedNotes) {
            updatedNotes[key] = updatedNotes[key].map((note) =>
              note.id === editingNoteId ? { ...note, text: editText } : note
            );
          }
          return updatedNotes;
        });
      }
      setEditingNoteId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setEditingNoteId(null); // Exit edit mode without saving
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
    console.log("addRow", index);
    
    const newRows = [...rows];
    newRows.splice(index, 0, ""); // Insert the new column at the given index
    setRows(newRows);

    // Shift existing notes first
    const updatedNotes = {};
    Object.keys(notes).forEach((key) => {
        const [row, col] = key.split("-").map(Number);
        if (row >= index) {
            updatedNotes[`${row + 1}-${col}`] = notes[key]; // Shift right
        } else {
            updatedNotes[key] = notes[key]; // Keep as is
        }
    });

    // Now initialize empty cells for the new row
    rows.forEach((colIndex, _) => {
        const newCellKey = `${index}-${colIndex}`;
        updatedNotes[newCellKey] = []; // Add empty cell at the new column
    });

    setNotes(updatedNotes);
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
    Object.keys(notes).forEach((key) => {
        const [row, col] = key.split("-").map(Number);
        if (col >= index) {
            updatedNotes[`${row}-${col + 1}`] = notes[key]; // Shift right
        } else {
            updatedNotes[key] = notes[key]; // Keep as is
        }
    });

    // Now initialize empty cells for the new column
    rows.forEach((_, rowIndex) => {
        const newCellKey = `${rowIndex}-${index}`;
        updatedNotes[newCellKey] = []; // Add empty cell at the new column
    });

    setNotes(updatedNotes);
    setEditingHeader({ row: null, col: index });
    setHeaderText("");
  };

  function isRowDeleteDisabled(rowIndex) {
    console.log(rowIndex)
    const rowKeyPrefix = `${rowIndex}-`;
    const rowlHasNotes = Object.keys(notes).some(
      key => key.startsWith(rowKeyPrefix) && notes[key].length > 0
    );
    return rowlHasNotes;
  }  

  // Remove Row
  const removeRow = (rowIndex) => {
    const rowKeyPrefix = `${rowIndex}-`;
    const rowHasNotes = Object.keys(notes).some(key => key.startsWith(rowKeyPrefix) && notes[key].length > 0);

    if (!rowHasNotes) {
      const newRows = rows.filter((_, index) => index !== rowIndex);
      const newNotes = Object.fromEntries(
        Object.entries(notes).filter(([key]) => !key.startsWith(rowKeyPrefix))
      );
      setRows(newRows);
      setNotes(newNotes);
    } else {
      alert("Cannot remove row with notes.");
    }
  };

  function isColumnDeleteDisabled(colIndex) {
    console.log(colIndex)
    const colKeyPrefix = `-${colIndex}`;
    const colHasNotes = Object.keys(notes).some(
      key => key.endsWith(colKeyPrefix) && notes[key].length > 0
    );
    return colHasNotes;
  }

  // Remove Column
  const removeColumn = (colIndex) => {
    const colKeyPrefix = `-${colIndex}`;
    const colHasNotes = Object.keys(notes).some(
      key => key.endsWith(colKeyPrefix) && notes[key].length > 0
    );
  
    if (!colHasNotes) {
      // Remove column from `cols` array
      const newCols = cols.filter((_, index) => index !== colIndex);
  
      // Create a new notes object with shifted keys
      const updatedNotes = {};
      Object.entries(notes).forEach(([key, value]) => {
        const [row, col] = key.split("-").map(Number);
  
        if (col < colIndex) {
          // Keep notes in columns before the deleted column
          updatedNotes[key] = value;
        } else if (col > colIndex) {
          // Shift columns after the deleted one to the left
          updatedNotes[`${row}-${col - 1}`] = value;
        }
      });
  
      setNotes(updatedNotes);
      setCols(newCols);
    } else {
      alert("Cannot remove column with notes.");
    }
  };
  

  return (
    <div>
      <button onClick={saveToJSON}>Save Notes</button>
      <input
        type="file"
        accept=".json"
        onChange={(e) => loadFromJSON(e.target.files[0])}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <div
          className="grid-container"
          style={{ gridTemplateColumns: `repeat(${cols.length}, max-content)` }}
        >
          {rows.map((row, rowIndex) =>
            cols.map((col, colIndex) => {
              const cellKey = `${rowIndex}-${colIndex}`;

              if ((rowIndex === 0) && (colIndex > 0)) {
                // Column headers
                return (
                  <div
                    className="column-header-cell"
                    onDoubleClick={() => handleHeaderDoubleClick(rowIndex, colIndex, false)}
                    onContextMenu={(event) => handleContextMenu(event, rowIndex, colIndex)}
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
                      col
                    )}

                    <Menu id={MENU_ID_COLUMN}>
                      <Item id="insert_col_left" onClick={() => addColumn(target.col)}>Insert column to left</Item>
                      <Item id="insert_col_right" onClick={() => addColumn(target.col+1)}>Insert column to right</Item>
                      <Separator />
                      <Item id="delete" disabled={() => isColumnDeleteDisabled(target.col)} onClick={() => removeColumn(target.col)}>Delete</Item>
                    </Menu>
                  </div>
                );
              }
          
              if (colIndex === 0) {
                // Row headers
                return (
                  <div
                    className="row-header-cell"
                    onDoubleClick={() => handleHeaderDoubleClick(rowIndex, colIndex, true)}
                    onContextMenu={(event) => handleContextMenu(event, rowIndex, colIndex)}
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
                      row
                    )}

                    <Menu id={MENU_ID_ROW}>
                      <Item id="insert_row_above" onClick={() => addRow(target.row)}>Insert row above</Item>
                      <Item id="insert_row_below" onClick={() => addRow(target.row+1)}>Insert row below</Item>
                      <Separator />
                      <Item id="delete" disabled={() => isRowDeleteDisabled(target.row)} onClick={() => removeRow(target.col)}>Delete</Item>
                    </Menu>
                  </div>
                );
              }

              return (
                <Droppable key={cellKey} droppableId={cellKey}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="droppable-cell"
                      onDoubleClick={() => handleDoubleClick(cellKey)}
                    >
                      {notes[cellKey]?.map((note, index) => (
                        <Draggable key={note.id} draggableId={note.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="note"
                              onDoubleClick={(e) => {
                                e.stopPropagation(); // Prevent triggering cell's double-click
                                handleNoteDoubleClick(note);
                              }}
                            >
                              {editingNoteId === note.id ? (
                                <textarea
                                  ref={textareaRef}
                                  type="text"
                                  value={editText}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  onKeyDown={handleKeyDown}
                                  autoFocus
                                />
                              ) : (
                                <ReactMarkdown>{note.text}</ReactMarkdown>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              );
            })
          )}
        </div>
      </DragDropContext>
    </div>
  );
};

export default Grid;
