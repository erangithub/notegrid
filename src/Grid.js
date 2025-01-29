import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown"
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import './Grid.css';

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

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editingHeader, setEditingHeader] = useState({ row: null, col: null });
  const [headerText, setHeaderText] = useState("");

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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        className="grid-container"
        style={{ gridTemplateColumns: `repeat(${cols.length}, max-content)` }}
      >
        {rows.map((row, rowIndex) =>
          cols.map((col, colIndex) => {
            const cellKey = `${rowIndex}-${colIndex}`;

            if (rowIndex === 0) {
              // Column headers
              return (
                <div
                  className="column-header-cell"
                  onDoubleClick={() => handleHeaderDoubleClick(rowIndex, colIndex, false)}
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
                </div>
              );
            }
        
            if (colIndex === 0) {
              // Row headers
              return (
                <div
                  className="row-header-cell"
                  onDoubleClick={() => handleHeaderDoubleClick(rowIndex, colIndex, true)}
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
  );
};

export default Grid;
