import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PianoApp from "@/components/PianoApp";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App min-h-screen bg-[#050505] text-white">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PianoApp />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}

export default App;
