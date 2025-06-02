"use client";

import React, { useState, useEffect } from "react";
import { useVideos } from "@/hooks/useVideos";
import type { FilterValues, Video } from "@/hooks/useVideos";
import VideoCard from "@/components/VideoCard";

export default function Home() {
  const [filters, setFilters] = useState<FilterValues>({
    startDate: null,
    productId: null,
    postedWithin: "any",
    adType: "all",
    gender: "all",
    sortBy: "view_growth",
  });

  const [activeTab, setActiveTab] = useState("trending");
  const [currentPage, setCurrentPage] = useState(1);
  const videosPerPage = 12;
  
  const { videos, loading, error } = useVideos(filters);
  
  // Filter videos based on selected filters
  const filteredVideos = videos.filter(video => {
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
              <h1 className="text-xl font-bold text-gray-900">Viral Videos</h1>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <nav className="flex items-center gap-6">
                <a href="#" className="flex items-center gap-2 text-gray-700 hover:text-purple-600">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                  Home
                </a>
                <a href="#" className="flex items-center gap-2 text-purple-600">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="8" cy="8" r="3"/>
                    <circle cx="16" cy="8" r="3"/>
                    <circle cx="8" cy="16" r="3"/>
                    <circle cx="16" cy="16" r="3"/>
                  </svg>
                  Discovery
                </a>
                <a href="#" className="flex items-center gap-2 text-gray-700 hover:text-purple-600">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  Projects
                </a>
                <a href="#" className="flex items-center gap-2 text-gray-700 hover:text-purple-600">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                  Education
                </a>
              </nav>
              
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Search"
                  className="px-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                  + New
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                  </svg>
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                </button>
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                  VV
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab-button ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            Trending
          </button>
          <button 
            className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`}
            onClick={() => setActiveTab('collections')}
          >
            Collections
          </button>
          <button 
            className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </button>
          <button 
            className={`tab-button ${activeTab === 'topics' ? 'active' : ''}`}
            onClick={() => setActiveTab('topics')}
          >
            Topics
          </button>
          <button 
            className={`tab-button ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Files
          </button>
          <button 
            className={`tab-button ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
          <button 
            className={`tab-button ${activeTab === 'people' ? 'active' : ''}`}
            onClick={() => setActiveTab('people')}
          >
            People
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter Bar */}
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <div className="flex flex-wrap items-end gap-6">
              {/* Date Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-white text-sm font-medium block mb-2">
                  Show the most viral content from:
                </label>
                <input
                  type="date"
                  value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFilters({...filters, startDate: new Date(e.target.value)})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
              
              {/* Product Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-white text-sm font-medium block mb-2">
                  Filter by product:
                </label>
                <select
                  value={filters.productId || ''}
                  onChange={(e) => setFilters({...filters, productId: e.target.value || null})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Select a product...</option>
                  {/* Product options will be populated from unique products */}
                  {Array.from(new Set(videos.filter(v => v.product_name).map(v => v.product_id)))
                    .slice(0, 20)
                    .map(productId => {
                      const product = videos.find(v => v.product_id === productId);
                      return product ? (
                        <option key={productId} value={productId}>
                          {product.product_name}
                        </option>
                      ) : null;
                    })}
                </select>
              </div>
              
              {/* Filter Button */}
              <div>
                <button
                  onClick={() => {
                    // Reset to page 1 when filtering
                    setCurrentPage(1);
                  }}
                  className="px-6 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                  </svg>
                  Filter Videos
                </button>
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-center text-gray-500 py-12">
              <svg className="animate-spin h-8 w-8 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Loading viral videos...
            </div>
          )}
          
          {error && (
            <div className="text-center py-12">
              <div className="text-red-500 mb-2">Error loading videos</div>
              <div className="text-gray-500 text-sm">{error}</div>
            </div>
          )}

          {!loading && !error && videos.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No videos found. Make sure your Supabase configuration is correct.
            </div>
          )}

          {!loading && !error && videos.length > 0 && filteredVideos.length === 0 && (
            <div className="text-center py-12 text-gray-500">
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
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

