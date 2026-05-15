<!-- 双组织背书示意：Org1 Peer <-> Orderer <- Org2 Peer -->
<template>
  <svg
    class="h-full w-full max-h-[100px] text-slate-400"
    viewBox="0 0 220 72"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Org1 与 Org2 背书拓扑示意"
  >
    <defs>
      <linearGradient id="wire" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35" />
        <stop offset="50%" stop-color="#6366f1" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.35" />
      </linearGradient>
    </defs>
    <rect x="86" y="8" width="48" height="22" rx="6" fill="rgba(15,23,42,0.9)" stroke="#475569" />
    <text x="110" y="24" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="system-ui">
      Orderer
    </text>
    <rect x="8" y="38" width="64" height="26" rx="8" fill="rgba(34,211,238,0.08)" stroke="#22d3ee" stroke-opacity="0.5" />
    <text x="40" y="56" text-anchor="middle" fill="#e2e8f0" font-size="11" font-family="system-ui">Org1 Peer</text>
    <rect x="148" y="38" width="64" height="26" rx="8" fill="rgba(99,102,241,0.1)" stroke="#818cf8" stroke-opacity="0.55" />
    <text x="180" y="56" text-anchor="middle" fill="#e2e8f0" font-size="11" font-family="system-ui">Org2 Peer</text>
    <path
      d="M 40 38 Q 70 18 110 30"
      fill="none"
      stroke="url(#wire)"
      stroke-width="1.5"
      stroke-dasharray="4 3"
    />
    <path
      d="M 180 38 Q 150 18 110 30"
      fill="none"
      stroke="url(#wire)"
      stroke-width="1.5"
      stroke-dasharray="4 3"
    />
    <circle cx="110" cy="30" r="3" fill="#22d3ee" class="animate-pulse" />
  </svg>
</template>
