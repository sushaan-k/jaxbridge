import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const HalideTopoHero: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Mouse Parallax Logic
    const handleMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;

      // Rotate the 3D Canvas
      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;

      // Apply depth shift to layers
      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        const depth = (index + 1) * 15;
        const moveX = x * (index + 1) * 0.2;
        const moveY = y * (index + 1) * 0.2;
        layer.style.transform = `translateZ(${depth}px) translate(${moveX}px, ${moveY}px)`;
      });
    };

    // Entrance Animation
    canvas.style.opacity = '0';
    canvas.style.transform = 'rotateX(90deg) rotateZ(0deg) scale(0.8)';

    const timeout = setTimeout(() => {
      canvas.style.transition = 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
      canvas.style.opacity = '1';
      canvas.style.transform = 'rotateX(55deg) rotateZ(-25deg) scale(1)';
    }, 300);

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <style>{`
        .halide-hero {
          background-color: var(--bg, #0a0a0a);
          color: var(--silver, #e0e0e0);
          font-family: var(--font-display, 'Syncopate', sans-serif);
          overflow: hidden;
          height: 100vh;
          width: 100vw;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .halide-grain-hero {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
          z-index: 5;
          opacity: 0.15;
        }

        .halide-viewport {
          perspective: 2000px;
          width: 100vw; height: 100vh;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }

        .halide-canvas-3d {
          position: relative;
          width: 800px; height: 500px;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .halide-layer {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(224, 224, 224, 0.1);
          background-size: cover;
          background-position: center;
          transition: transform 0.5s ease;
        }

        .halide-layer-1 {
          background-image: url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.2) brightness(0.4);
        }
        .halide-layer-2 {
          background-image: url('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.1) brightness(0.5);
          opacity: 0.6;
          mix-blend-mode: screen;
        }
        .halide-layer-3 {
          background-image: url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.3) brightness(0.6);
          opacity: 0.4;
          mix-blend-mode: overlay;
        }

        .halide-contours {
          position: absolute;
          width: 200%; height: 200%;
          top: -50%; left: -50%;
          background-image: repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 40px, rgba(255,255,255,0.05) 41px, transparent 42px);
          transform: translateZ(120px);
          pointer-events: none;
        }

        .halide-interface-grid {
          position: absolute;
          inset: 0;
          padding: 3rem 4rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr auto;
          z-index: 10;
          pointer-events: none;
        }

        .halide-hero-title {
          grid-column: 1 / -1;
          align-self: center;
          font-size: clamp(3rem, 10vw, 10rem);
          line-height: 0.85;
          letter-spacing: -0.04em;
          mix-blend-mode: difference;
          font-family: var(--font-display, 'Syncopate', sans-serif);
          font-weight: 700;
        }

        /* Typewriter effect */
        .typewriter-line {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          border-right: 3px solid var(--accent-red, #ff3c00);
          width: 0;
          animation: typewrite 1.6s cubic-bezier(0.25, 0.1, 0.25, 1) forwards,
                     blink-caret 0.6s step-end infinite;
        }
        .typewriter-line-2 {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          border-right: 3px solid var(--accent-red, #ff3c00);
          width: 0;
          animation: typewrite 1.2s cubic-bezier(0.25, 0.1, 0.25, 1) 1.4s forwards,
                     blink-caret 0.6s step-end 1.4s infinite;
        }
        .typewriter-line-2.done-typing {
          border-right-color: transparent;
        }

        @keyframes typewrite {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes blink-caret {
          from, to { border-color: transparent; }
          50% { border-color: var(--accent-red, #ff3c00); }
        }

        .halide-scroll-hint {
          position: absolute;
          bottom: 2rem; left: 50%;
          width: 1px; height: 60px;
          background: linear-gradient(to bottom, var(--silver, #e0e0e0), transparent);
          animation: flow 2s infinite ease-in-out;
          z-index: 10;
        }

        @keyframes flow {
          0%, 100% { transform: scaleY(0); transform-origin: top; }
          50% { transform: scaleY(1); transform-origin: top; }
          51% { transform: scaleY(1); transform-origin: bottom; }
        }

        @media (max-width: 768px) {
          .halide-interface-grid {
            padding: 2rem;
          }
          .halide-canvas-3d {
            width: 400px;
            height: 300px;
          }
        }
      `}</style>

      <div className="halide-hero">
        {/* SVG Filter for Grain */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>

        <div className="halide-grain-hero" style={{ filter: 'url(#grain)' }}></div>

        <div className="halide-interface-grid">
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '0.8rem', letterSpacing: '0.2em' }}>
            JAXBRIDGE
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-red)', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
            <div>DUVAL COUNTY, FL</div>
            <div>30.3322°N — 81.6557°W</div>
            <div style={{ marginTop: '0.25rem', color: 'rgba(224,224,224,0.4)' }}>LIFE EXPECTANCY DELTA: 14.3 YR</div>
          </div>

          <h1 className="halide-hero-title">
            <span className="typewriter-line">CLOSING</span><br />
            <span className="typewriter-line-2">THE GAP</span>
          </h1>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'auto' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              <p style={{ margin: '0 0 0.25rem', color: 'rgba(224,224,224,0.5)' }}>[ AI4GOOD DATATHON 2026 ]</p>
              <p style={{ margin: 0 }}>PREDICTING WHERE TO INVEST TO EXTEND LIVES</p>
              <p style={{ margin: '0.15rem 0 0', color: 'rgba(224,224,224,0.4)' }}>1,035 AI AGENTS SIMULATE REAL RESIDENTS TO VALIDATE EVERY RECOMMENDATION</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/atlas" className="btn-tech">
                EXPLORE MAP
              </Link>
              <Link to="/simulator/32209" className="btn-tech btn-tech-primary">
                RUN SIMULATION
              </Link>
            </div>
          </div>
        </div>

        <div className="halide-viewport">
          <div className="halide-canvas-3d" ref={canvasRef}>
            <div className="halide-layer halide-layer-1" ref={(el) => { if (el) layersRef.current[0] = el; }}></div>
            <div className="halide-layer halide-layer-2" ref={(el) => { if (el) layersRef.current[1] = el; }}></div>
            <div className="halide-layer halide-layer-3" ref={(el) => { if (el) layersRef.current[2] = el; }}></div>
            <div className="halide-contours"></div>
          </div>
        </div>

        <div className="halide-scroll-hint"></div>
      </div>
    </>
  );
};

export default HalideTopoHero;
