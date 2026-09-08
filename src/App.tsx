import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Home } from "@/pages/Home";
import { Explore } from "@/pages/Explore";
import { Topics } from "@/pages/Topics";
import { Systems } from "@/pages/Systems";
import { Concepts } from "@/pages/Concepts";
import { About } from "@/pages/About";
import { NotFound } from "@/pages/NotFound";

// The topic page pulls in React Flow + Framer Motion — split it into its
// own chunk since most navigation starts on lighter pages.
const TopicPage = lazy(() => import("@/pages/TopicPage").then((m) => ({ default: m.TopicPage })));

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/systems" element={<Systems />} />
        <Route path="/concepts" element={<Concepts />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/topic/:id"
          element={
            <Suspense fallback={<div className="px-6 py-20 text-center text-sm text-muted-foreground">Loading…</div>}>
              <TopicPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
