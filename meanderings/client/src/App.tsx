import React from "react";

import ConversationContainer from "./machines/ConversationContainer";

// ConversationMachineProvider is now in main.tsx, so we don't need to wrap ConversationContainer

const App: React.FC = () => {
  return (
    <div
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      className="text-left"
    >
      <ConversationContainer />
    </div>
  );
};

export default App;
