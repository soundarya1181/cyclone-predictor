import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, ChevronDown, X, Loader2, Globe, Navigation } from 'lucide-react';
import { searchLocations, fetchTamilNaduLocations } from '../services/api';

export default function LocationSearch({ onSelectLocation, selectedLocation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [tamilNaduLocations, setTamilNaduLocations] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'tamilnadu'
  const [searchError, setSearchError] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Load Tamil Nadu locations on mount
  useEffect(() => {
    fetchTamilNaduLocations()
      .then((data) => setTamilNaduLocations(data.locations || []))
      .catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSearchError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const data = await searchLocations(val.trim(), 12);
          setResults(data.results || []);
          setActiveTab('search');
          setShowDropdown(true);
        } catch (err) {
          setSearchError('Search failed. Check backend connection.');
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 400);
    } else {
      setResults([]);
    }
  };

  const handleSelect = (loc) => {
    setQuery(loc.display_name || loc.name);
    setShowDropdown(false);
    if (onSelectLocation) {
      onSelectLocation({
        lat: loc.latitude,
        lng: loc.longitude,
        name: loc.display_name || loc.name,
        country: loc.country || '',
        state: loc.state || '',
        district: loc.district || '',
      });
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const coastalTN = tamilNaduLocations.filter((l) => l.coastal);
  const inlandTN = tamilNaduLocations.filter((l) => !l.coastal);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => {
            if (!showDropdown && (results.length > 0 || tamilNaduLocations.length > 0)) {
              setShowDropdown(true);
            } else if (tamilNaduLocations.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder="🔍 Search any location worldwide (e.g. Chennai, Tokyo, New York)..."
          className="w-full bg-ops-900 border border-ops-700 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition"
        />
        {isSearching && (
          <Loader2 className="absolute right-8 w-4 h-4 text-blue-400 animate-spin" />
        )}
        {query && (
          <button onClick={handleClear} className="absolute right-3 text-slate-500 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {searchError && (
        <p className="text-xs text-red-400 mt-1 px-1">{searchError}</p>
      )}

      {/* Dropdown Panel */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-ops-900 border border-ops-700 rounded-xl shadow-2xl overflow-hidden max-h-[420px] flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-ops-700 bg-ops-950 flex-shrink-0">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'search'
                  ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Worldwide Search {results.length > 0 && `(${results.length})`}
            </button>
            <button
              onClick={() => setActiveTab('tamilnadu')}
              className={`flex-1 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'tamilnadu'
                  ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-950/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🗺 Tamil Nadu ({tamilNaduLocations.length} locations)
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Worldwide search results */}
            {activeTab === 'search' && (
              <>
                {results.length > 0 ? (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-ops-950 border-b border-ops-800">
                      📍 Open-Meteo Geocoding — Worldwide Results
                    </div>
                    {results.map((loc) => (
                      <button
                        key={`${loc.latitude}-${loc.longitude}`}
                        onClick={() => handleSelect(loc)}
                        className="w-full text-left px-4 py-2.5 hover:bg-ops-800 border-b border-ops-800/50 transition group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold text-white group-hover:text-blue-300">
                              {loc.name}
                            </span>
                            {loc.state && (
                              <span className="text-slate-400 text-xs"> — {loc.state}</span>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-400">{loc.country}</span>
                              {loc.population && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Pop: {loc.population.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 pt-0.5">
                            {loc.latitude?.toFixed(2)}°N {loc.longitude?.toFixed(2)}°E
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query.length >= 2 && !isSearching ? (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    No results found for "{query}"
                  </div>
                ) : query.length < 2 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    Type at least 2 characters to search worldwide locations
                  </div>
                ) : null}
              </>
            )}

            {/* Tamil Nadu preset locations */}
            {activeTab === 'tamilnadu' && (
              <div>
                {coastalTN.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wider bg-ops-950 border-b border-ops-800 sticky top-0">
                      🌊 Coastal Districts (Higher Cyclone Exposure) — {coastalTN.length} locations
                    </div>
                    {coastalTN.map((loc) => (
                      <button
                        key={loc.name}
                        onClick={() => handleSelect({
                          ...loc,
                          display_name: loc.display_name || `${loc.name}, Tamil Nadu`
                        })}
                        className="w-full text-left px-4 py-2.5 hover:bg-ops-800 border-b border-ops-800/50 transition group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-semibold text-white group-hover:text-red-300">
                              {loc.name}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1.5">{loc.district}</span>
                            {loc.population && (
                              <span className="text-[10px] text-slate-500 ml-2 font-mono">
                                Pop: {loc.population.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-red-500/70">
                            🌊 Coastal
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {inlandTN.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-ops-950 border-b border-ops-800 sticky top-0">
                      🏙 Inland Cities & Districts — {inlandTN.length} locations
                    </div>
                    {inlandTN.map((loc) => (
                      <button
                        key={loc.name}
                        onClick={() => handleSelect({
                          ...loc,
                          display_name: loc.display_name || `${loc.name}, Tamil Nadu`
                        })}
                        className="w-full text-left px-4 py-2.5 hover:bg-ops-800 border-b border-ops-800/50 transition group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-semibold text-white group-hover:text-emerald-300">
                              {loc.name}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1.5">{loc.district}</span>
                            {loc.population && (
                              <span className="text-[10px] text-slate-500 ml-2 font-mono">
                                Pop: {loc.population.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {loc.latitude?.toFixed(2)}°N {loc.longitude?.toFixed(2)}°E
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ops-700 bg-ops-950 px-3 py-1.5 flex-shrink-0">
            <p className="text-[10px] text-slate-500">
              Powered by <a href="https://geocoding-api.open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Open-Meteo Geocoding API</a> — 100% Free, No API Key
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
