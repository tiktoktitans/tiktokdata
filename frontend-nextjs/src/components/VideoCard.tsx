import React, { useState } from 'react';
import { Video } from '@/hooks/useVideos';

interface VideoCardProps {
  video: Video;
  rank: number;
}

export default function VideoCard({ video, rank }: VideoCardProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Enable audio context on first user interaction
  React.useEffect(() => {
    const enableAudio = () => {
      // This helps browsers allow audio autoplay after user interaction
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
    
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
    
    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
  }, []);
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

  // Truncate caption to consistent length
  const truncateCaption = (text: string | null, maxLength: number = 80) => {
    if (!text) return 'No caption available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle video play/pause
  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Start video playback with audio enabled
  const startVideo = async () => {
    if (videoRef.current) {
      // Always ensure video is unmuted and has volume
      videoRef.current.muted = false;
      videoRef.current.volume = 0.8; // Set volume to 80%
      
      try {
        await videoRef.current.play();
        setIsPlaying(true);
        setIsMuted(false);
      } catch (error) {
        // If browser blocks autoplay, try a few more approaches
        try {
          // Try playing with slightly lower volume
          videoRef.current.volume = 0.5;
          await videoRef.current.play();
          setIsPlaying(true);
          setIsMuted(false);
        } catch (retryError) {
          // Last resort - force play with interaction
          setIsPlaying(false);
          setIsMuted(false);
          console.log('Autoplay prevented by browser policy');
        }
      }
    }
  };

  // Toggle mute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div className="video-card">
      {/* Rank Badge */}
      <div className="rank-badge">#{rank}</div>
      
      {/* Thumbnail with video preview on hover */}
      <div 
        className="video-thumbnail"
        onMouseEnter={() => {
          hoverTimeoutRef.current = setTimeout(() => {
            setShowVideo(true);
            setShowControls(true);
            // Start video immediately when shown
            setTimeout(startVideo, 50);
          }, 100);
        }}
        onMouseLeave={() => {
          setShowVideo(false);
          setIsPlaying(false);
          setCurrentTime(0);
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
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
              ref={videoRef}
              src={video.video_url} 
              loop
              playsInline
              preload="auto"
              className="preview-video"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleVideoEnded}
              onLoadedData={() => {
                if (showVideo && videoRef.current) {
                  startVideo();
                }
              }}
              onCanPlay={() => {
                if (showVideo && videoRef.current) {
                  startVideo();
                }
              }}
            />
            
            {/* Video Controls Overlay */}
            {showControls && (
              <div className="video-controls-overlay">
                {/* Play/Pause Button */}
                <button 
                  onClick={togglePlayPause}
                  className="video-play-btn"
                  aria-label={isPlaying ? 'Pause video' : 'Play video'}
                >
                  {isPlaying ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* Progress Bar Container */}
                <div className="video-progress-container">
                  <div className="video-time-display">
                    <span>{formatTime(currentTime)}</span>
                    <span>/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  
                  <div 
                    className="video-progress-bar"
                    onClick={handleProgressClick}
                  >
                    <div className="video-progress-track">
                      <div 
                        className="video-progress-fill"
                        style={{ 
                          width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' 
                        }}
                      />
                      <div 
                        className="video-progress-handle"
                        style={{ 
                          left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Mute/Unmute Button */}
                <button 
                  onClick={toggleMute}
                  className="video-mute-btn"
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                >
                  {isMuted ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content section */}
      <div className="card-content">
        <div className="card-top-section">
          {/* Product info - Always show this section */}
          <div className="product-info">
            {video.product_image && video.product_name ? (
              <>
                <img 
                  src={video.product_image} 
                  alt={video.product_name}
                  className="product-image"
                />
                <span className="product-name">{video.product_name}</span>
              </>
            ) : (
              <>
                <div className="product-placeholder-icon">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="product-placeholder-text">Product details unavailable</span>
              </>
            )}
          </div>
          
          {/* User info */}
          <div className="user-section">
            <span className="username">@{video.username || 'unknown'}</span>
            <span className="date">{formatDate(video.created_at)}</span>
          </div>
          
          {/* Caption */}
          <div className="caption-container">
            <p className="caption">{truncateCaption(video.caption)}</p>
          </div>
        </div>
        
        <div className="card-bottom-section">
          {/* Analytics */}
          <div className="analytics-modern">
            <div className="stat-modern">
              <div className="stat-icon-modern views">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-number">{formatNumber(video.views)}</span>
                <span className="stat-label">views</span>
              </div>
            </div>

            <div className="stat-modern">
              <div className="stat-icon-modern likes">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-number">{formatNumber(video.likes)}</span>
                <span className="stat-label">likes</span>
              </div>
            </div>

            <div className="stat-modern">
              <div className="stat-icon-modern comments">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h11c.55 0 1-.45 1-1z"/>
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-number">{formatNumber(video.comments)}</span>
                <span className="stat-label">comments</span>
              </div>
            </div>

            <div className="stat-modern">
              <div className="stat-icon-modern shares">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-number">{formatNumber(video.shares)}</span>
                <span className="stat-label">shares</span>
              </div>
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
    </div>
  );
}