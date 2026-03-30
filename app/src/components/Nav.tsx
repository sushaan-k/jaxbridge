import { Link, useLocation } from 'react-router-dom';

const links = [
  { path: '/', label: 'HOME' },
  { path: '/atlas', label: 'ATLAS' },
  { path: '/simulator', label: 'SIMULATOR' },
  { path: '/agents', label: 'AGENTS' },
  { path: '/correlations', label: 'INSIGHTS' },
  { path: '/scorecard', label: 'SCORECARD' },
];

function Logo() {
  return (
    <svg width="140" height="28" viewBox="0 0 140 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bridge icon — two towers with arc */}
      <rect x="2" y="8" width="3" height="16" rx="1" fill="#ff3c00" />
      <rect x="19" y="8" width="3" height="16" rx="1" fill="#ff3c00" />
      <path d="M3.5 10 C3.5 4, 20.5 4, 20.5 10" stroke="#ff3c00" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Horizontal road deck */}
      <rect x="0" y="18" width="24" height="2" rx="1" fill="#e0e0e0" opacity="0.3" />
      {/* Text: JAXBRIDGE */}
      <text x="30" y="20" fill="#e0e0e0" fontSize="13" fontWeight="800" fontFamily="'Syncopate', sans-serif" letterSpacing="0.12em">
        JAX
      </text>
      <text x="68" y="20" fill="#ff3c00" fontSize="13" fontWeight="800" fontFamily="'Syncopate', sans-serif" letterSpacing="0.12em">
        BRIDGE
      </text>
    </svg>
  );
}

export function Nav() {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000]" style={{
      background: 'rgba(10, 10, 10, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(224, 224, 224, 0.06)',
    }}>
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between h-12">
          <Link to="/" className="no-underline flex items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-0.5">
            {links.map(link => {
              const isActive = location.pathname === link.path ||
                (link.path === '/simulator' && location.pathname.startsWith('/simulator'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className="no-underline font-mono text-[10px] tracking-[0.15em] transition-all px-3 py-1.5"
                  style={{
                    color: isActive ? 'var(--accent-red)' : 'rgba(224, 224, 224, 0.5)',
                    borderBottom: isActive ? '1px solid var(--accent-red)' : '1px solid transparent',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
