"use client";

import { useAuth } from "./lib/AuthContext";
import AuthPage from "./components/AuthPage";
import DracoChat from "./components/DracoChat";
import { SceneController } from "./components/SceneController";
import LightningBackground from "./components/LightningBackground";

export default function Home() {
  const { user, loading } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
        <div className="fixed inset-0 z-0 pointer-events-none mix-blend-screen opacity-40">
          <LightningBackground hue={270} intensity={0.8} size={1.0} speed={0.4} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <img
            src="/dragon_final.png"
            alt="Draco"
            className="w-16 h-16 object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.5)] animate-pulse"
          />
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not signed in — go straight to sign-in page
  if (!user) {
    return <AuthPage />;
  }

  // Signed in — show the full chat app
  return (
    <SceneController>
      <DracoChat />
    </SceneController>
  );
}
