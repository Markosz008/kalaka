import React from 'react';

export default function KalakaLogo({ className = 'w-16 h-16', onClick }) {
  return (
    <svg
      className={className}
      onClick={onClick}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kaláka logó"
    >
      <rect width="512" height="512" rx="116" fill="#1E4635" />
      <rect x="148" y="128" width="28" height="58" fill="#F5F2EA" />
      <path d="M116 218 L216 122 L262 166" stroke="#F5F2EA" stroke-width="26" stroke-linecap="square" stroke-linejoin="miter" fill="none" />
      <path d="M148 224 L190 184 V248 L314 124 H374 L190 308 V392 H148 Z" fill="#F5F2EA" />
      <path d="M242 284 L306 348 C338 380 388 372 390 322" stroke="#F5F2EA" stroke-width="38" stroke-linecap="butt" fill="none" />
      <path fill-rule="evenodd" clip-rule="evenodd" d="M348 210 C322 210 302 230 302 256 C302 290 348 332 348 332 C348 332 394 290 394 256 C394 230 374 210 348 210 Z M348 273 C338.6 273 331 265.4 331 256 C331 246.6 338.6 239 348 239 C357.4 239 365 246.6 365 256 C365 265.4 357.4 273 348 273 Z" fill="#C25938" />
    </svg>
  );
}
