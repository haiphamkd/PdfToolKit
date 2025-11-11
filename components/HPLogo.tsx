import React from 'react';

export const HPLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-labelledby="logoTitle"
  >
    <title id="logoTitle">Logo Hai Pham PDF Compressor</title>
    
    {/* PDF Document Outline */}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    
    {/* Stylized "HP" Monogram Inside */}
    <path d="M9 18V12" />
    <path d="M9 15h4" />
    <path d="M13 18V12h1.5a1.5 1.5 0 0 1 0 3H13" />
  </svg>
);
