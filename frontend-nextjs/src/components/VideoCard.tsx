import React, { useState } from 'react';
import { Video } from '@/hooks/useVideos';

interface VideoCardProps {
  video: Video;
  rank: number;
}

export default function VideoCard({ video, rank }: VideoCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  // Format numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Format video duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="video-card">
      {/* Rank Badge */}
      <div className="rank-badge">#{rank}</div>
      
      {/* Thumbnail with video preview on hover */}
      <div 
        className="video-thumbnail"
        onMouseEnter={() => {
          setIsHovering(true);
          setTimeout(() => {
            if (isHovering) setShowVideo(true);
          }, 500);
        }}
        onMouseLeave={() => {
          setIsHovering(false);
          setShowVideo(false);
        }}
      >
        <img 
          src={video.thumbnail_url || '/placeholder.jpg'} 
          alt={video.caption || 'Video thumbnail'}
        />
        
        {/* Video duration badge */}
        <div className="duration-badge">
          {formatDuration(video.video_duration)}
        </div>
        
        {/* Video preview popup */}
        {showVideo && video.video_url && (
          <div className="video-preview">
            <video 
              src={video.video_url} 
              autoPlay 
              muted 
              loop
              className="preview-video"
            />
          </div>
        )}
      </div>

      {/* Content section */}
      <div className="card-content">
        {/* Product info */}
        {video.product_image && video.product_name && (
          <div className="product-info">
            <img 
              src={video.product_image} 
              alt={video.product_name}
              className="product-image"
            />
            <span className="product-name">{video.product_name}</span>
          </div>
        )}
        
        {/* User info */}
        <div className="user-section">
          <span className="username">@{video.username || 'unknown'}</span>
          <span className="date">{formatDate(video.created_at)}</span>
        </div>
        
        {/* Caption */}
        <p className="caption">{video.caption}</p>
        
        {/* Analytics */}
        <div className="analytics-grid">
          <div className="stat">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            <span>{formatNumber(video.views)} views</span>
          </div>
          <div className="stat">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{formatNumber(video.likes)} likes</span>
          </div>
          <div className="stat">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <span>{formatNumber(video.comments)}</span>
          </div>
          <div className="stat">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.684C18.114 15.938 18 15.482 18 15c0-.482.114-.938.316-1.342m0 2.684a3 3 0 110-2.684M9.316 10.658a3 3 0 105.368 0"/>
            </svg>
            <span>{formatNumber(video.shares)}</span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="action-buttons">
          <button className="action-btn transcribe-btn">
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"/>
            </svg>
            Transcribe
          </button>
          <button className="action-btn related-btn">
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 4v16M17 4v16M3 12h18M3 12a9 9 0 019-9 9 9 0 019 9-9 9 0 01-9 9 9 9 0 01-9-9z"/>
            </svg>
            Related
          </button>
        </div>
      </div>
    </div>
  );
}