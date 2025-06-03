"use client";

import React, { useState, useEffect } from "react";
import { useVideos } from "@/hooks/useVideos";
import type { FilterValues, Video } from "@/hooks/useVideos";
import VideoCard from "@/components/VideoCard";
import ModernDatePicker from "@/components/ModernDatePicker";

export default function Home() {
  const [filters, setFilters] = useState<FilterValues>({
    startDate: null,
    productId: null,
    postedWithin: "any",
    adType: "all",
    gender: "all",
    sortBy: "view_growth",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const videosPerPage = 12;

  // Mobile menu functionality
  useEffect(() => {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    const toggleMobileMenu = () => {
      if (mobileMenu) {
        const isHidden = mobileMenu.classList.contains('hidden');
        if (isHidden) {
          mobileMenu.classList.remove('hidden');
          mobileMenu.style.maxHeight = mobileMenu.scrollHeight + "px";
        } else {
          mobileMenu.style.maxHeight = "0px";
          setTimeout(() => {
            if (mobileMenu.style.maxHeight === "0px") {
              mobileMenu.classList.add('hidden');
            }
          }, 300);
        }
      }
    };

    mobileMenuButton?.addEventListener('click', toggleMobileMenu);

    return () => {
      mobileMenuButton?.removeEventListener('click', toggleMobileMenu);
    };
  }, []);

  
  const { videos, loading, error } = useVideos(filters);

  // Early return for error state
  if (error) {
    console.error('Video loading error:', error);
  }
  
  // Filter videos based on selected filters
  const filteredVideos = (videos || []).filter(video => {
    // Filter by product if selected
    if (filters.productId && video.product_id !== filters.productId) {
      return false;
    }
    
    // Filter by date if selected
    if (filters.startDate) {
      const videoDate = new Date(video.created_at || video.scraped_at || '');
      if (videoDate < filters.startDate) {
        return false;
      }
    }
    
    return true;
  });
  
  // Calculate pagination
  const indexOfLastVideo = currentPage * videosPerPage;
  const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
  const currentVideos = filteredVideos.slice(indexOfFirstVideo, indexOfLastVideo);
  const totalPages = Math.ceil(filteredVideos.length / videosPerPage);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-light)' }}>
      {/* Header */}
      <header className="glass sticky top-0 z-50" style={{ 
        backdropFilter: 'blur(20px)',
        background: 'rgba(255, 255, 255, 0.85)',
        borderBottom: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <a href="#" className="flex items-center space-x-3 text-xl sm:text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity duration-200" style={{ color: 'var(--text-dark)' }}>
              <img 
                src="/logo.png" 
                alt="TikTok Titans Logo" 
                className="w-8 h-8 rounded-lg object-contain"
              />
              <span>TikTok Titans</span>
            </a>

            <nav className="hidden lg:flex items-center space-x-1">
              <a href="#" className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 focus-ring" style={{
                color: 'var(--text-medium)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = 'var(--text-dark)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-medium)';
              }}>
                <svg className="w-4 h-4 mr-2" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Videos
              </a>
              <a href="#" className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 focus-ring" style={{
                color: 'var(--text-medium)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = 'var(--text-dark)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-medium)';
              }}>
                <svg className="w-4 h-4 mr-2" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Products
              </a>

              <div className="relative group">
                <button className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 focus-ring" style={{
                  color: 'var(--text-medium)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.color = 'var(--text-dark)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-medium)';
                }}>
                  <svg className="w-4 h-4 mr-2" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  Analytics
                  <svg className="ml-1.5 h-4 w-4" style={{ color: 'var(--text-light)' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="dropdown-menu absolute left-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-dropdown)',
                  padding: '8px'
                }}>
                  <a href="#" className="dropdown-item block px-3 py-2.5 text-sm rounded-lg transition-all duration-150" style={{ color: 'var(--text-medium)' }}>Trending Analysis</a>
                  <a href="#" className="dropdown-item block px-3 py-2.5 text-sm rounded-lg transition-all duration-150" style={{ color: 'var(--text-medium)' }}>Performance Metrics</a>
                  <a href="#" className="dropdown-item block px-3 py-2.5 text-sm rounded-lg transition-all duration-150" style={{ color: 'var(--text-medium)' }}>Creator Insights</a>
                </div>
              </div>

              <div className="relative group">
                <button className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 focus-ring" style={{
                  color: 'var(--text-medium)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.color = 'var(--text-dark)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-medium)';
                }}>
                  <svg className="w-4 h-4 mr-2" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.52-.635 1.421-.84 2.23-.65l2.072.69c.43.144.859.356 1.25.625m-3.286 3.286a3.75 3.75 0 112.652-2.652m0 0L21 12M11.42 15.17l-4.135-5.012a.75.75 0 010-1.062l2.48-3.006a.75.75 0 011.062 0l5.012 4.135M4.5 15.75A3.75 3.75 0 018.25 12H12m0 0V8.25A3.75 3.75 0 0115.75 4.5v0A3.75 3.75 0 0112 8.25m0 0H8.25A3.75 3.75 0 014.5 12v0A3.75 3.75 0 018.25 15.75H12m0 0V19.5m0 0V12" />
                  </svg>
                  Tools
                  <svg className="ml-1.5 h-4 w-4" style={{ color: 'var(--text-light)' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="dropdown-menu absolute left-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-dropdown)',
                  padding: '8px'
                }}>
                  <a href="#" className="dropdown-item block px-3 py-2.5 text-sm rounded-lg transition-all duration-150" style={{ color: 'var(--text-medium)' }}>Content Scheduler</a>
                  <a href="#" className="dropdown-item block px-3 py-2.5 text-sm rounded-lg transition-all duration-150" style={{ color: 'var(--text-medium)' }}>Hashtag Generator</a>
                  <a href="#" className="dropdown-item block px-3 py-2.5 text-sm rounded-lg transition-all duration-150" style={{ color: 'var(--text-medium)' }}>Trend Predictor</a>
                </div>
              </div>
            </nav>

            <div className="lg:hidden">
              <button id="mobile-menu-button" className="p-2 rounded-lg transition-all duration-150 focus-ring" style={{
                border: '1px solid var(--border-light)',
                color: 'var(--text-medium)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderColor = 'var(--primary-coral)';
                e.currentTarget.style.color = 'var(--primary-coral)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.color = 'var(--text-medium)';
              }}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            </div>
          </div>

          <div id="mobile-menu" className="lg:hidden hidden overflow-hidden max-h-0">
            <nav className="flex flex-col space-y-1 pt-3 pb-2 mt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
              <a href="#" className="flex items-center px-3 py-2.5 rounded-lg text-base font-medium transition-all duration-150" style={{ color: 'var(--text-medium)' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = 'var(--text-dark)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-medium)';
              }}>
                <svg className="w-5 h-5 mr-3" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
                </svg>
                Videos
              </a>
              <a href="#" className="flex items-center px-3 py-2.5 rounded-lg text-base font-medium transition-all duration-150" style={{ color: 'var(--text-medium)' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = 'var(--text-dark)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-medium)';
              }}>
                <svg className="w-5 h-5 mr-3" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10.5 11.25h3M12 15V7.5m0 0l-2.25 2.25M12 7.5l2.25 2.25" />
                </svg>
                Products
              </a>
              <a href="#" className="flex items-center px-3 py-2.5 rounded-lg text-base font-medium transition-all duration-150" style={{ color: 'var(--text-medium)' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = 'var(--text-dark)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-medium)';
              }}>
                <svg className="w-5 h-5 mr-3" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                Analytics
              </a>
              <a href="#" className="flex items-center px-3 py-2.5 rounded-lg text-base font-medium transition-all duration-150" style={{ color: 'var(--text-medium)' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = 'var(--text-dark)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-medium)';
              }}>
                <svg className="w-5 h-5 mr-3" style={{ color: 'var(--primary-coral)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.52-.635 1.421-.84 2.23-.65l2.072.69c.43.144.859.356 1.25.625m-3.286 3.286a3.75 3.75 0 112.652-2.652m0 0L21 12M11.42 15.17l-4.135-5.012a.75.75 0 010-1.062l2.48-3.006a.75.75 0 011.062 0l5.012 4.135M4.5 15.75A3.75 3.75 0 018.25 12H12m0 0V8.25A3.75 3.75 0 0115.75 4.5v0A3.75 3.75 0 0112 8.25m0 0H8.25A3.75 3.75 0 014.5 12v0A3.75 3.75 0 018.25 15.75H12m0 0V19.5m0 0V12" />
                </svg>
                Tools
              </a>
            </nav>
          </div>
        </div>
        
      </header>

      {/* Filter Section */}
      <div style={{ backgroundColor: 'var(--bg-white)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <section>
            <div className="flex flex-col md:flex-row md:items-end md:space-x-6 space-y-6 md:space-y-0">
              <div className="flex-1 min-w-0 md:min-w-[240px]">
                <label htmlFor="date-filter" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-medium)' }}>
                  Show the most viral content from:
                </label>
                <ModernDatePicker
                  selected={filters.startDate}
                  onChange={(date) => setFilters({...filters, startDate: date})}
                  placeholder="June 02, 2025"
                />
              </div>
              <div className="flex-1 min-w-0 md:min-w-[240px]">
                <label htmlFor="product-filter" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-medium)' }}>
                  Filter by product:
                </label>
                <div className="relative">
                  <select
                    id="product-filter"
                    value={filters.productId || ''}
                    onChange={(e) => setFilters({...filters, productId: e.target.value || null})}
                    className="form-input appearance-none block w-full p-3 text-sm rounded-lg focus-ring transition-all duration-150"
                  >
                    <option value="" style={{ color: 'var(--text-light)' }}>Select a product...</option>
                    {Array.from(new Set((videos || []).filter(v => v.product_name).map(v => v.product_id)))
                      .slice(0, 20)
                      .map(productId => {
                        const product = (videos || []).find(v => v.product_id === productId);
                        return product ? (
                          <option key={productId} value={productId || ''}>
                            {product.product_name}
                          </option>
                        ) : null;
                      })}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <svg className="w-5 h-5" style={{ color: 'var(--text-light)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="md:ml-auto pt-4 md:pt-0 md:self-end">
                <button
                  type="button"
                  onClick={() => {
                    setFilters({
                      startDate: null,
                      productId: null,
                      postedWithin: "any",
                      adType: "all",
                      gender: "all",
                      sortBy: "view_growth",
                    });
                    setCurrentPage(1);
                  }}
                  className="btn-primary w-full md:w-auto flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg focus-ring transition-all duration-150"
                >
                  <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.572a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                  </svg>
                  Filter Videos
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Main Content */}
      <main className="py-8" style={{ backgroundColor: 'var(--bg-light)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {loading && (
            <div className="text-center py-12" style={{ color: 'var(--text-light)' }}>
              <svg className="animate-spin h-8 w-8 mx-auto mb-4" viewBox="0 0 24 24" style={{ color: 'var(--primary-coral)' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Loading viral videos...
            </div>
          )}
          
          {error && (
            <div className="text-center py-12">
              <div className="mb-2" style={{ color: 'var(--primary-coral)' }}>Error loading videos</div>
              <div className="text-sm" style={{ color: 'var(--text-light)' }}>{error}</div>
            </div>
          )}

          {!loading && !error && videos.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-light)' }}>
              No videos found. Make sure your Supabase configuration is correct.
            </div>
          )}

          {!loading && !error && videos.length > 0 && filteredVideos.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-light)' }}>
              No videos match your filter criteria. Try adjusting your filters.
            </div>
          )}

          {!loading && !error && filteredVideos.length > 0 && (
            <>
              <div className="video-grid">
                {currentVideos.map((video, index) => (
                  <VideoCard
                    key={video.aweme_id}
                    video={video}
                    rank={indexOfFirstVideo + index + 1}
                  />
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-ring" style={{
                      backgroundColor: 'var(--bg-white)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-medium)'
                    }}
                    onMouseOver={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-white)';
                      }
                    }}
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2" style={{ color: 'var(--text-medium)' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-ring" style={{
                      backgroundColor: 'var(--bg-white)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-medium)'
                    }}
                    onMouseOver={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-white)';
                      }
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

