import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import './Grid.css';

const Grid = () => {
  const rows = ["Todo", "People", "Topic 1", "Topic 2"];
  const cols = ["Alice", "Bob", "Charlie", "Diana"];

  // Initial state for notes in cells with ids and texts
  const [notes, setNotes] = useState({
    "0-0": [
      { id: "note-0-0-0", text: "Note 1" },
      { id: "note-0-0-1", text: "Note 2" },
    ],
    "1-2": [
      { id: "note-1-2-0", text: "Vacation Note" },
    ],
  });

  const onDragEnd = (result) => {
    console.log("Drag Result:", result);

    if (!result.destination) return;

    const { source, destination } = result;
    const sourceKey = source.droppableId;
    const destinationKey = destination.droppableId;

    // If source and destination are the same, we don't need to do anything
    if (sourceKey === destinationKey) {
      const sourceNotes = Array.from(notes[sourceKey]);
      const [removed] = sourceNotes.splice(source.index, 1);
      sourceNotes.splice(destination.index, 0, removed);

      setNotes({
        ...notes,
        [sourceKey]: sourceNotes,
      });
    } else {
      // Moving notes between cells
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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid-container"
        style={{
          gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
          gridTemplateRows: `repeat(${rows.length}, auto)`,
        }}
      >
        {rows.map((row, rowIndex) =>
          cols.map((col, colIndex) => {
            const cellKey = `${rowIndex}-${colIndex}`;
            return (
              <Droppable key={cellKey} droppableId={cellKey}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="droppable-cell"
                  >
                    <strong>{`${row} - ${col}`}</strong>
                    {notes[cellKey]?.map((note, index) => {
                      const draggableId = note.id; // Use the note's id here
                      return (
                        <Draggable
                          key={draggableId}
                          draggableId={draggableId}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="note"
                            >
                              {note.text} {/* Render the note's text here */}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
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
