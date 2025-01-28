import React from "react";
import Grid from "./Grid"; // Adjust the path if needed

function App() {
  return (
    <div className="App">
      <header className="p-4 bg-blue-600 text-white text-lg font-bold">
        NoteGrid - Team Meeting Notes
      </header>
      <main className="p-4">
        <Grid />
      </main>
    </div>
  );
}

export default App;
