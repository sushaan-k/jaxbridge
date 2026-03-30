import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Landing } from './pages/Landing';
import { Atlas } from './pages/Atlas';
import { Simulator } from './pages/Simulator';
import { Correlations } from './pages/Correlations';
import { Scorecard } from './pages/Scorecard';
import { AgentGraph } from './pages/AgentGraph';
import { Nav } from './components/Nav';
import './App.css';

/* ─── Custom Cursor: Trailing shimmer dots ─── */
const TRAIL_COUNT = 8;

function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const trail = trailRef.current;
    if (!dot || !trail) return;

    // Create trail dots
    const dots: HTMLDivElement[] = [];
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const d = document.createElement('div');
      d.className = 'cursor-trail-dot';
      const size = Math.max(2, 5 - i * 0.4);
      d.style.width = `${size}px`;
      d.style.height = `${size}px`;
      trail.appendChild(d);
      dots.push(d);
    }

    const positions = Array.from({ length: TRAIL_COUNT }, () => ({ x: 0, y: 0 }));
    let mouseX = 0, mouseY = 0;
    let isHovering = false;

    const move = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const raf = () => {
      // Lead dot
      dot.style.transform = `translate(${mouseX - 2.5}px, ${mouseY - 2.5}px)`;
      dot.style.boxShadow = isHovering
        ? '0 0 16px rgba(255,60,0,0.8), 0 0 32px rgba(255,60,0,0.3)'
        : '0 0 8px rgba(255,60,0,0.5)';
      dot.style.width = isHovering ? '8px' : '5px';
      dot.style.height = isHovering ? '8px' : '5px';

      // Trail follows with decreasing speed
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const target = i === 0 ? { x: mouseX, y: mouseY } : positions[i - 1];
        const speed = 0.25 - i * 0.02;
        positions[i].x += (target.x - positions[i].x) * speed;
        positions[i].y += (target.y - positions[i].y) * speed;

        const d = dots[i];
        const size = parseFloat(d.style.width);
        d.style.transform = `translate(${positions[i].x - size / 2}px, ${positions[i].y - size / 2}px)`;

        // Shimmer: opacity pulses based on distance from cursor
        const dist = Math.sqrt((positions[i].x - mouseX) ** 2 + (positions[i].y - mouseY) ** 2);
        const baseOpacity = 0.5 - i * 0.06;
        const shimmer = Math.sin(Date.now() * 0.005 + i * 0.8) * 0.15;
        d.style.opacity = `${Math.max(0, Math.min(dist > 2 ? baseOpacity + shimmer : 0, 0.7))}`;
      }

      requestAnimationFrame(raf);
    };

    const addHover = () => { isHovering = true; };
    const removeHover = () => { isHovering = false; };

    window.addEventListener('mousemove', move);
    requestAnimationFrame(raf);

    const observe = () => {
      document.querySelectorAll('a, button, [role="button"], input, select, textarea').forEach(el => {
        el.addEventListener('mouseenter', addHover);
        el.addEventListener('mouseleave', removeHover);
      });
    };
    observe();
    const observer = new MutationObserver(observe);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('mousemove', move);
      observer.disconnect();
      dots.forEach(d => d.remove());
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={trailRef} className="cursor-trail" />
    </>
  );
}

/* ─── Page Wrapper with Transition ─── */
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}

/* ─── App Content ─── */
function AppContent() {
  const location = useLocation();
  const hideNav = location.pathname === '/agents';

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--foreground)' }}>
      {!hideNav && <Nav />}
      <PageTransition>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/simulator/:zipCode" element={<Simulator />} />
          <Route path="/correlations" element={<Correlations />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/agents" element={<AgentGraph />} />
        </Routes>
      </PageTransition>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
