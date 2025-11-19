import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

// GradientBackground Component
const GradientBackground = () => {
  const interactiveRef = useRef(null);
  const [curX, setCurX] = useState(0);
  const [curY, setCurY] = useState(0);
  const [tgX, setTgX] = useState(0);
  const [tgY, setTgY] = useState(0);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setCurX((prev) => prev + (tgX - prev) / 20);
      setCurY((prev) => prev + (tgY - prev) / 20);

      if (interactiveRef.current) {
        interactiveRef.current.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
      }
    }, 1000 / 60);

    return () => clearInterval(moveInterval);
  }, [curX, curY, tgX, tgY]);

  const handleMouseMove = (event) => {
    if (interactiveRef.current) {
      const rect = interactiveRef.current.getBoundingClientRect();
      setTgX(event.clientX - rect.left);
      setTgY(event.clientY - rect.top);
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-[linear-gradient(40deg,rgb(108,0,162),rgb(0,17,82))]">
      <svg className="hidden">
        <defs>
          <filter id="blurMe">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="10"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div
        className={`gradients-container h-full w-full blur-lg ${isSafari ? "blur-2xl" : "[filter:url(#blurMe)_blur(40px)]"}`}
      >
        <div className="absolute [background:radial-gradient(circle_at_center,_rgba(18,113,255,0.8)_0,_rgba(18,113,255,0)_50%)_no-repeat] [mix-blend-mode:hard-light] w-[80%] h-[80%] top-[calc(50%-40%)] left-[calc(50%-40%)] [transform-origin:center_center] animate-first opacity-100" />
        <div className="absolute [background:radial-gradient(circle_at_center,_rgba(221,74,255,0.8)_0,_rgba(221,74,255,0)_50%)_no-repeat] [mix-blend-mode:hard-light] w-[80%] h-[80%] top-[calc(50%-40%)] left-[calc(50%-40%)] [transform-origin:calc(50%-400px)] animate-second opacity-100" />
        <div className="absolute [background:radial-gradient(circle_at_center,_rgba(100,220,255,0.8)_0,_rgba(100,220,255,0)_50%)_no-repeat] [mix-blend-mode:hard-light] w-[80%] h-[80%] top-[calc(50%-40%)] left-[calc(50%-40%)] [transform-origin:calc(50%+400px)] animate-third opacity-100" />
        <div className="absolute [background:radial-gradient(circle_at_center,_rgba(200,50,50,0.8)_0,_rgba(200,50,50,0)_50%)_no-repeat] [mix-blend-mode:hard-light] w-[80%] h-[80%] top-[calc(50%-40%)] left-[calc(50%-40%)] [transform-origin:calc(50%-200px)] animate-fourth opacity-70" />
        <div className="absolute [background:radial-gradient(circle_at_center,_rgba(180,180,50,0.8)_0,_rgba(180,180,50,0)_50%)_no-repeat] [mix-blend-mode:hard-light] w-[80%] h-[80%] top-[calc(50%-40%)] left-[calc(50%-40%)] [transform-origin:calc(50%-800px)_calc(50%+800px)] animate-fifth opacity-100" />

        <div
          ref={interactiveRef}
          onMouseMove={handleMouseMove}
          className="absolute [background:radial-gradient(circle_at_center,_rgba(140,100,255,0.8)_0,_rgba(140,100,255,0)_50%)_no-repeat] [mix-blend-mode:hard-light] w-full h-full -top-1/2 -left-1/2 opacity-70"
        />
      </div>

      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-5xl font-bold mb-4">Gradient Background</h1>
          <p className="text-xl">
            Interactive animated background with mouse tracking
          </p>
        </div>
      </div>
    </div>
  );
};

function Layout({ children, user, currentTenant, onLogout, onSwitchTenant }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const navigation = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 5c-4.418 0-8 3.134-8 7 0 1.657.672 3.166 1.785 4.34A2 2 0 007.2 17h9.6a2 2 0 001.415-.66A6.22 6.22 0 0020 12c0-3.866-3.582-7-8-7z"
          />
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 14l2-2 2 2"
          />
        </svg>
      ),
    },
    ...(user?.role === 'global_admin' ||
    user?.role === 'admin' ||
    user?.role === 'client_admin' ||
    user?.role === 'msp_admin'
      ? [
          {
            name: 'Tenants',
            path: '/tenants',
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 21V8a2 2 0 012-2h2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6m2 0h2a2 2 0 012 2v13M6 10h2m-2 4h2m4-4h2m-2 4h2"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...(user?.role === 'global_admin' || user?.role === 'client_admin'
      ? [
          {
            name: 'Users',
            path: '/users',
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"
                />
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 11a4 4 0 11-8 0 4 4 0 018 0z"
                />
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9v2m0 4v2"
                />
                <circle cx="19" cy="5" r="2" />
              </svg>
            ),
          },
        ]
      : []),
    {
      name: 'Automations',
      path: '/automations',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    ...(user?.role === 'global_admin' ||
    user?.role === 'admin' ||
    user?.role === 'client_admin' ||
    user?.role === 'msp_admin'
      ? [
          {
            name: 'Billing',
            path: '/billing',
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 8v8l-4-4 4-4zM8 8v8l-4-4 4-4"
                />
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12c0 4.418-4.477 8-10 8a12.25 12.25 0 01-4.5-.5c-.1-.04-.2-.08-.27-.12l-.5-.4a11.7 11.7 0 01-3.4-4.4 12 12 0 01-1.5-3.6V5.5c0-1.1.9-2 2-2h1.5a2 2 0 012 2v1c0 1.1-.9 2-2 2H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h1c1.1 0 2 .9 2 2v1.5c0 .1-.04 .2-.08 .27l-.4 .5a11.7 11.7 0 004.4 3.4A12.25 12.25 0 0015.5 19.5c.4.04.8.08 1.2.08 1.6.04 2.1 0"
                />
              </svg>
            ),
          },
        ]
      : []),
    {
      name: 'Settings',
      path: '/settings',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317a1.724 1.724 0 013.35 0 1.724 1.724 0 002.573 1.066 1.724 1.724 0 012.37 2.37 1.724 1.724 0 001.065 2.572 1.724 1.724 0 010 3.35 1.724 1.724 0 00-1.066 2.573 1.724 1.724 0 01-2.37 2.37 1.724 1.724 0 00-2.573 1.065 1.724 1.724 0 01-3.35 0 1.724 1.724 0 00-2.573-1.066 1.724 1.724 0 01-2.37-2.37 1.724 1.724 0 00-1.065-2.572 1.724 1.724 0 010-3.35 1.724 1.724 0 001.066-2.573 1.724 1.724 0 012.37-2.37 1.724 1.724 0 002.573-1.066z"
          />
          <path
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    ...(user?.role === 'global_admin' ||
    user?.role === 'admin' ||
    user?.role === 'client_admin' ||
    user?.role === 'msp_admin'
      ? [
          {
            name: 'Reporting',
            path: '/reporting',
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6M12 3v14M5 11h14"
                />
              </svg>
            ),
          },
        ]
      : []),
  ];

  const isActive = (path) => location.pathname === path;

  // Tenant status polling
  useEffect(() => {
    if (!currentTenant?.domain) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/tenants/status/${currentTenant.domain}`
        );
      const data = await response.json();
        if (data.tenant?.status === 'suspended') {
          alert(
            'Your account has been suspended. You will be logged out.'
          );
          onLogout();
        }
      } catch (error) {
        console.error('Error checking tenant status:', error);
      }
    };

    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [currentTenant, onLogout]);

  // Axios interceptors for role / tenant
  useEffect(() => {
    if (!user) return;

    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (user.role) {
          config.headers['x-user-role'] = user.role;
        }
        if (user.tenantId) {
          config.headers['x-tenant-id'] = user.tenantId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, [user]);

  const tenantInitial =
    currentTenant?.name?.charAt(0).toUpperCase() ||
    (user?.role === 'admin' || user?.role === 'global_admin'
      ? 'A'
      : 'T');

  const userInitial =
    user?.name?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'U';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex text-white">
      {/* Sidebar */}
      <aside
        className={`relative ${
          sidebarOpen ? 'w-72' : 'w-20'
        } flex flex-col transition-all duration-300`}
      >
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg border-r border-slate-800/80 shadow-2xl shadow-black/40" />
        <div className="relative flex flex-col h-full">
          {/* Brand + toggle */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/40">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] text-slate-500 uppercase tracking-[0.16em]">
                    Automara
                  </span>
                  <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Control Center
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/40">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            )}

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {sidebarOpen ? (
                  <path
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                ) : (
                  <path
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Tenant summary */}
          <div className="px-4 py-3 border-b border-slate-800/80">
            <div className="w-full bg-slate-950/70 hover:bg-slate-900/80 border border-slate-800 rounded-2xl px-3 py-3 flex items-center gap-3 transition-all">
              {sidebarOpen ? (
                <>
                  <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justifycenter text-xs font-bold text-white shadow-md shadow-purple-500/30">
                    {tenantInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wide">
                      {user?.role === 'global_admin' ||
                      user?.role === 'admin'
                        ? 'Global Context'
                        : 'Current Tenant'}
                    </div>
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {currentTenant?.name ||
                        (user?.role === 'global_admin' ||
                        user?.role === 'admin'
                          ? 'All Tenants'
                          : 'Select Tenant')}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {currentTenant?.domain || 'Multi-tenant overview'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justifycenter text-xs font-bold text-white shadow-md shadow-purple-500/30">
                  {tenantInitial}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-purple-500/20'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justifycenter transition-all ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'bg-slate-900/80 text-slate-400 group-hover:bg-slate-900 group-hover:text-purple-300'
                    }`}
                  >
                    {item.icon}
                  </div>
                  {sidebarOpen && (
                    <span
                      className={`truncate ${
                        active
                          ? 'text-white'
                          : 'text-slate-300 group-hover:text-white'
                      }`}
                    >
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User / Logout */}
          <div className="px-4 py-4 border-t border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justifycenter text-white font-bold shadow-lg shadow-blue-500/30">
                  {userInitial}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {user?.name || user?.email}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
                      {user?.role}
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/80 transition-colors"
                    title="Logout"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </button>
                </>
              )}
              {!sidebarOpen && (
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/80 transition-colors"
                  title="Logout"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto relative">
        {/* Apply GradientBackground when on dashboard */}
        {location.pathname === '/dashboard' ? (
          <div className="absolute inset-0 z-0">
            <GradientBackground />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 z-0" />
        )}
        
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;