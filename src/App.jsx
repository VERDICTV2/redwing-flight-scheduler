import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plane, Upload, Clock, Calendar, Users, MapPin, ArrowRight, LayoutGrid, List, AlertCircle, FileText, ArrowUpRight, ArrowDownRight, AlertTriangle, Bug, Moon, Sun, CheckCircle } from 'lucide-react';
import { generateStressData, generateEdgeCaseData } from './utils/testData';

// --- Sample Data from User PDF (Tweaked to show Overlap) ---
const SAMPLE_DATA = `,"PDR","ARK","PDR-0930","ARK-1000","AS04","08L","59N","Chandra","krupa"
,"PDR","CHP","PDR-0935","CHP-1030","AS05","08L","59N","Krupa","Mohan"
,"PDR","MCP","PDR-1015","MCP-1045","AS06","42C","59N","Mohan","Chandra"
,"ARK","PDR","ARK-1015","PDR-1045","AS04","59N","08L","Shivaji","Sundar"
,"PDR","TJG","PDR-1035","TJG-1105","AS08","35H","59N","Ankush","Chandra"
,"CHP","PDR","CHP-1045","PDR-1120","AS05","59N","16D","Milan","John"
"Pickup/ Delivery",,,,,,,,,
,"MCG","PDR","MCG-1105","PDR-1135","AS06","59N","42C","Dhanaraju","Abijith"
,"PDR","ARK","PDR-1105","ARK-1135","AS04","08L","59N","Chandra","Krupa"
,"TJG","PDR","TJG-1125","PDR-1155","AS08","59N","35H","Adi","Fesham"
,"PDR","SKM","PDR-1145","SKM-1215","AS05","16D","59N","Mohan","Krupa"
,"ARK","PDR","ARK-1150","PDR-1220","AS04","59N","08L","Sundar","Shivaji"
,"PDR","LTG","PDR-1210","LTG-1240","AS06","42C","59N","Krupa","Ankush"
,"SKM","PDR","SKM-1230","PDR-1305","AS05","59N","16D","Debasish","Ajay"
,"PDR","CHP","PDR-1250","CHP-1330","AS04","08L","59N","Ankush","Chandra"
,"LTG","PDR","LTG-1255","PDR-1330","AS06","59N","42C","Sakthi","Abhinava"
,"CHP","PDR","CHP-1345","PDR-1420","AS04","59N","08L","John","Milan"
"Pickup/ Delivery",,,,,,,,,
,"PDR","MCP","PDR-1340","MCP-1410","AS05","16D","59N","Krupa","Mohan"
,"PDR","ARK","PDR-1505","ARK-1535","AS04","08L","59N","Ankush","Chandra"
,"MCP","PDR","MCP-1430","PDR-1500","AS05","59N","16D","Abijith","Dhanaraju"
,"ARK","PDR","ARK-1550","PDR-1620","AS04","59N","08L","Shivaji","Sundar"`;

// --- Utility Functions (Untouched) ---

const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{4})/);
    if (!match) return null;
    const digits = match[1];
    const hours = parseInt(digits.substring(0, 2), 10);
    const minutes = parseInt(digits.substring(2, 4), 10);
    return hours * 60 + minutes;
};

const formatTime = (minutes) => {
    if (minutes === null || isNaN(minutes)) return "--:--";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const parseScheduleData = (text) => {
    const rows = text.split('\n');
    const flights = [];

    const parseCSVLine = (line, index) => {
        const cleanRow = line.trim();
        if (!cleanRow || cleanRow.startsWith('"Pickup') || cleanRow.startsWith('Pickup')) return null;

        const matches = cleanRow.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || cleanRow.split(',');
        const cols = matches.map(s => s.replace(/^"|"$/g, '').replace(/^,/, '').trim());

        const etdIndex = cols.findIndex(c => /[A-Z]{3}\s*-\s*\d{4}/.test(c));

        if (etdIndex === -1) return null;

        const etdRaw = cols[etdIndex];
        const etaRaw = cols[etdIndex + 1];
        const aircraft = cols[etdIndex + 2];

        if (!etdRaw || !etaRaw || !aircraft) return null;

        const fromMatch = etdRaw.match(/^([A-Z]{3})/);
        const toMatch = etaRaw.match(/^([A-Z]{3})/);
        const from = fromMatch ? fromMatch[1] : (cols[etdIndex - 2] || 'UNK');
        const to = toMatch ? toMatch[1] : (cols[etdIndex - 1] || 'UNK');

        const takeoffPad = cols[etdIndex + 3] || 'Unknown';
        const landingPad = cols[etdIndex + 4] || 'Unknown';
        const operator = cols[etdIndex + 5] || '';
        const crew = cols[etdIndex + 6] || '';

        const start = parseTime(etdRaw);
        const end = parseTime(etaRaw);

        if (start !== null && end !== null) {
            return {
                id: index,
                from,
                to,
                start,
                end,
                duration: end - start,
                aircraft,
                takeoffPad,
                landingPad,
                operator,
                crew,
                rawEtd: etdRaw,
                rawEta: etaRaw
            };
        }
        return null;
    };

    const parseUnstructuredText = (fullText) => {
        // Regex matches patterns like "ARK-1150" and captures Operator/Crew if available
        const regex = /([A-Z]{3}\s*-?\s*\d{3,4})\s+([A-Z]{3}\s*-?\s*\d{3,4})\s+(AS\d+)(?:\s+([0-9A-Z]+))?(?:\s+([0-9A-Z]+))?(?:\s+([A-Za-z]+))?(?:\s+([A-Za-z]+))?/g;
        const extracted = [];
        let match;
        let idx = 0;

        const normalizedText = fullText.replace(/\n/g, ' ');

        while ((match = regex.exec(normalizedText)) !== null) {
            const etdRaw = match[1];
            const etaRaw = match[2];
            const aircraft = match[3];
            const takeoffPad = match[4] || 'TBD';
            const landingPad = match[5] || 'TBD';
            const operator = match[6] || 'Parsed from PDF';
            const crew = match[7] || 'Parsed from PDF';

            const start = parseTime(etdRaw);
            const end = parseTime(etaRaw);

            const fromMatch = etdRaw.match(/^([A-Z]{3})/);
            const toMatch = etaRaw.match(/^([A-Z]{3})/);
            const from = fromMatch ? fromMatch[1] : 'UNK';
            const to = toMatch ? toMatch[1] : 'UNK';

            if (start !== null && end !== null) {
                extracted.push({
                    id: `extracted-${idx++}`,
                    from,
                    to,
                    start,
                    end,
                    duration: end - start,
                    aircraft,
                    takeoffPad,
                    landingPad,
                    operator,
                    crew,
                    rawEtd: etdRaw,
                    rawEta: etaRaw
                });
            }
        }
        return extracted;
    };

    rows.forEach((row, index) => {
        const flight = parseCSVLine(row, index);
        if (flight) flights.push(flight);
    });

    if (flights.length === 0) {
        const regexFlights = parseUnstructuredText(text);
        if (regexFlights.length > 0) {
            return regexFlights.sort((a, b) => a.start - b.start);
        }
    }

    return flights.sort((a, b) => a.start - b.start);
};

// --- Components ---

const TooltipOverlay = ({ event, position }) => {
    if (!event || !position) return null;

    // Handle Global Conflict Tooltip
    if (event.type === 'conflict') {
        const top = position.y - 10;
        const left = position.x;
        const style = {
            top: `${top}px`,
            left: `${left}px`,
            transform: 'translate(-50%, -100%)',
            position: 'fixed'
        };

        return (
            <div className="z-[9999] pointer-events-none" style={style}>
                <div className="bg-yellow-100 dark:bg-yellow-900/80 text-yellow-900 dark:text-yellow-100 text-xs rounded-lg p-3 shadow-2xl border border-yellow-400 dark:border-yellow-600 w-48 text-center backdrop-blur-sm">
                    <div className="font-bold uppercase text-yellow-700 dark:text-yellow-300 mb-1 border-b border-yellow-300 dark:border-yellow-700 pb-1 flex items-center justify-center gap-2">
                        <AlertTriangle size={12} /> Overlap Detected
                    </div>
                    <div className="font-mono text-sm">
                        {formatTime(event.start)} - {formatTime(event.end)}
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">
                        Duration: {event.duration} mins
                    </div>
                </div>
                <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/80 border-r border-b border-yellow-400 dark:border-yellow-600 transform rotate-45 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1.5"></div>
            </div>
        );
    }

    // Handle Flight Event Tooltip
    const isDeparture = event.type === 'departure';

    let top = position.y - 10;
    let left = position.x;

    const style = {
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(-50%, -100%)',
        position: 'fixed'
    };

    return (
        <div className="z-[9999] pointer-events-none" style={style}>
            <div className="w-64 bg-zinc-900 text-white text-xs rounded-lg p-3 shadow-2xl border border-zinc-700">
                <div className="flex justify-between items-center mb-2 border-b border-zinc-700 pb-2">
                    <span className={`font-bold uppercase ${isDeparture ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isDeparture ? 'Departure' : 'Arrival'}
                    </span>
                    <span className="font-mono text-white text-sm">{formatTime(event.time)}</span>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Aircraft:</span>
                        <span className="font-semibold text-white">{event.flight.aircraft}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Route:</span>
                        <span className="text-gray-200">{event.flight.from} ➝ {event.flight.to}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Pad Used:</span>
                        <span className="text-gray-200">{event.pad}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Crew:</span>
                        <span className="text-gray-200">{event.flight.crew}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Operator:</span>
                        <span className="text-gray-200">{event.flight.operator}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Buffer:</span>
                        <span className="opacity-75">{formatTime(event.time - 5)} - {formatTime(event.time + 5)}</span>
                    </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 text-right">
                    Duration: {event.flight.duration} min
                </div>
            </div>
            <div className="w-3 h-3 bg-zinc-900 border-r border-b border-zinc-700 transform rotate-45 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1.5"></div>
        </div>
    );
};

// Renders the vertical bar across the whole chart
const GlobalConflictBar = ({ conflict, style, onHover, onLeave }) => {
    const handleMouseEnter = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover({
            type: 'conflict',
            start: conflict.start,
            end: conflict.end,
            duration: conflict.duration
        }, {
            x: rect.left + rect.width / 2,
            y: rect.top
        });
    };

    return (
        <div
            className="absolute top-0 bottom-0 z-20 flex justify-center hover:bg-yellow-500/30 transition-colors cursor-help group"
            style={{ ...style, minWidth: '4px' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={onLeave}
        >
            <div className="w-full h-full bg-yellow-500/20 border-x-2 border-dashed border-yellow-500/40 relative pointer-events-none">
                {/* Optional label at top of column */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <div className="bg-yellow-500 text-white text-[8px] font-bold px-1 rounded shadow-sm whitespace-nowrap">
                        OVERLAP
                    </div>
                </div>
            </div>
        </div>
    );
};

const HubEventMarker = ({ event, style, onHover, onLeave }) => {
    const [localHover, setLocalHover] = useState(false);
    const isDeparture = event.type === 'departure';

    // KEEPING ORIGINAL TIMELINE COLORS AS REQUESTED
    const lineColor = isDeparture ? 'bg-emerald-500' : 'bg-red-500';
    const bufferColor = isDeparture ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-red-500/20 border-red-500/30';
    const iconColor = isDeparture ? 'text-emerald-700' : 'text-red-700';

    const handleMouseEnter = (e) => {
        setLocalHover(true);
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(event, {
            x: rect.left + rect.width / 2,
            y: rect.top
        });
    };

    const handleMouseLeave = () => {
        setLocalHover(false);
        onLeave();
    };

    return (
        <div
            className="absolute h-10 top-2 z-30 group"
            style={style}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className={`w-full h-full rounded-md border ${bufferColor} relative flex items-center justify-center transition-all duration-200 ${localHover ? 'border-opacity-100 ring-1 ring-offset-1 ring-blue-300' : ''}`}>
                <div className={`absolute h-full w-0.5 ${lineColor} left-1/2 -translate-x-1/2`}></div>
                <div className={`z-20 ${iconColor} bg-white/90 dark:bg-black/90 rounded-full p-0.5 shadow-sm`}>
                    {isDeparture ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
                </div>
            </div>
        </div>
    );
};

const Timeline = ({ flights, viewMode, onEventHover, onEventLeave }) => {
    const startOfDay = 8 * 60; // 08:00
    const endOfDay = 17 * 60;  // 17:00
    const totalDuration = endOfDay - startOfDay;
    const HUB_ID = "PDR";
    const BUFFER_MINS = 5;

    // 1. Process events for global check
    const allEvents = useMemo(() => {
        const list = [];
        flights.forEach(f => {
            if (f.from === HUB_ID && f.takeoffPad) {
                list.push({ start: f.start - BUFFER_MINS, end: f.start + BUFFER_MINS });
            }
            if (f.to === HUB_ID && f.landingPad) {
                list.push({ start: f.end - BUFFER_MINS, end: f.end + BUFFER_MINS });
            }
        });
        return list;
    }, [flights]);

    // 2. Global Conflicts
    const globalConflicts = useMemo(() => {
        const timelineMap = new Array(endOfDay - startOfDay + 1).fill(0);

        allEvents.forEach(evt => {
            const startIdx = Math.max(0, evt.start - startOfDay);
            const endIdx = Math.min(timelineMap.length - 1, evt.end - startOfDay);
            for (let i = startIdx; i < endIdx; i++) {
                timelineMap[i]++;
            }
        });

        const conflicts = [];
        let inConflict = false;
        let conflictStart = 0;

        for (let i = 0; i < timelineMap.length; i++) {
            if (timelineMap[i] > 1 && !inConflict) {
                inConflict = true;
                conflictStart = i;
            } else if (timelineMap[i] <= 1 && inConflict) {
                inConflict = false;
                conflicts.push({
                    start: conflictStart + startOfDay,
                    end: i + startOfDay,
                    duration: i - conflictStart
                });
            }
        }
        if (inConflict) {
            conflicts.push({
                start: conflictStart + startOfDay,
                end: endOfDay,
                duration: endOfDay - (conflictStart + startOfDay)
            });
        }
        return conflicts;
    }, [allEvents]);


    // 3. Row Data
    const rows = useMemo(() => {
        const groups = {};

        flights.forEach(f => {
            if (f.from === HUB_ID) {
                const key = viewMode === 'pad' ? f.takeoffPad : f.aircraft;
                if (key && key !== 'Unknown') {
                    if (!groups[key]) groups[key] = [];
                    groups[key].push({
                        id: `dep-${f.id}`,
                        type: 'departure',
                        time: f.start,
                        pad: f.takeoffPad,
                        flight: f,
                        startBuffer: f.start - BUFFER_MINS,
                        endBuffer: f.start + BUFFER_MINS
                    });
                }
            }

            if (f.to === HUB_ID) {
                const key = viewMode === 'pad' ? f.landingPad : f.aircraft;
                if (key && key !== 'Unknown') {
                    if (!groups[key]) groups[key] = [];
                    groups[key].push({
                        id: `arr-${f.id}`,
                        type: 'arrival',
                        time: f.end,
                        pad: f.landingPad,
                        flight: f,
                        startBuffer: f.end - BUFFER_MINS,
                        endBuffer: f.end + BUFFER_MINS
                    });
                }
            }
        });

        const rowData = Object.keys(groups).sort().map(key => {
            const events = groups[key].sort((a, b) => a.startBuffer - b.startBuffer);
            return {
                id: key,
                label: key,
                events: events,
                overlaps: []
            };
        });

        return rowData;
    }, [flights, viewMode]);

    const hours = [];
    for (let t = startOfDay; t <= endOfDay; t += 60) {
        hours.push(t);
    }

    return (
        <div className="w-full overflow-x-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-inner scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-zinc-700">
            <div className="min-w-[1000px] relative">
                {/* Header */}
                <div className="h-10 bg-gray-50 dark:bg-zinc-800 border-b border-gray-300 dark:border-zinc-700 flex sticky top-0 z-50">
                    <div className="w-32 flex-shrink-0 bg-gray-50 dark:bg-zinc-800 border-r border-gray-300 dark:border-zinc-700 sticky left-0 z-50 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 text-sm shadow-sm">
                        {viewMode === 'pad' ? 'Hub Pad ID' : 'Aircraft ID'}
                    </div>
                    <div className="flex-grow relative">
                        {hours.map(time => (
                            <div
                                key={time}
                                className="absolute h-full border-l border-gray-300 dark:border-zinc-700 text-xs text-gray-500 dark:text-gray-400 pl-1 pt-2 font-mono"
                                style={{ left: `${((time - startOfDay) / totalDuration) * 100}%` }}
                            >
                                {Math.floor(time / 60)}:00
                            </div>
                        ))}
                    </div>
                </div>

                {/* Global Conflict Overlay */}
                <div className="absolute top-10 bottom-0 left-32 right-0 z-20">
                    {globalConflicts.map((conflict, idx) => {
                        const startPct = ((conflict.start - startOfDay) / totalDuration) * 100;
                        const widthPct = (conflict.duration / totalDuration) * 100;
                        return (
                            <GlobalConflictBar
                                key={`global-${idx}`}
                                conflict={conflict}
                                onHover={onEventHover}
                                onLeave={onEventLeave}
                                style={{
                                    left: `${Math.max(0, startPct)}%`,
                                    width: `${widthPct}%`
                                }}
                            />
                        );
                    })}
                </div>

                {/* Rows */}
                <div className="divide-y divide-gray-200 dark:divide-zinc-800 relative bg-white dark:bg-zinc-950">
                    {rows.map(row => (
                        <div key={row.id} className="h-14 flex group bg-white dark:bg-zinc-950 hover:bg-gray-50/80 dark:hover:bg-zinc-900/80 transition-colors relative">
                            {/* Row Label */}
                            <div className="w-32 flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky left-0 z-40 flex items-center px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm group-hover:bg-gray-50 dark:group-hover:bg-zinc-900 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                <div className={`w-2 h-8 rounded-full mr-3 ${viewMode === 'pad' ? 'bg-red-600' : 'bg-zinc-600'}`}></div>
                                {row.label}
                            </div>

                            <div className="flex-grow relative">
                                {/* Grid Lines */}
                                {hours.map(time => (
                                    <div
                                        key={time}
                                        className="absolute h-full border-l border-gray-100 dark:border-zinc-800"
                                        style={{ left: `${((time - startOfDay) / totalDuration) * 100}%` }}
                                    />
                                ))}

                                {/* Events */}
                                {row.events.map(event => {
                                    const leftPct = ((event.startBuffer - startOfDay) / totalDuration) * 100;
                                    const widthPct = ((BUFFER_MINS * 2) / totalDuration) * 100;

                                    return (
                                        <HubEventMarker
                                            key={event.id}
                                            event={event}
                                            onHover={onEventHover}
                                            onLeave={onEventLeave}
                                            style={{
                                                left: `${leftPct}%`,
                                                width: `${widthPct}%`
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {rows.length === 0 && (
                        <div className="p-12 text-center text-gray-400 dark:text-zinc-600">
                            No flight operations found at HUB (PDR).
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function FlightScheduleApp() {
    const [rawData, setRawData] = useState(SAMPLE_DATA);
    const [flights, setFlights] = useState([]);
    const [viewMode, setViewMode] = useState('pad');
    const [showInput, setShowInput] = useState(false);
    const [showDevTools, setShowDevTools] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    const [hoveredEvent, setHoveredEvent] = useState(null);
    const [tooltipPos, setTooltipPos] = useState(null);

    // Dark Mode Toggle Logic
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js";
        script.async = true;
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
            }
        };
        document.body.appendChild(script);
    }, []);

    useEffect(() => {
        const parsed = parseScheduleData(rawData);
        setFlights(parsed);
    }, [rawData]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type === 'application/pdf') {
            setIsLoading(true);
            try {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const typedarray = new Uint8Array(ev.target.result);

                    if (!window.pdfjsLib) {
                        alert("PDF Library still loading. Please try again in 2 seconds.");
                        setIsLoading(false);
                        return;
                    }

                    const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }

                    setRawData(fullText);
                    setShowInput(false);
                    setIsLoading(false);
                };
                reader.readAsArrayBuffer(file);
            } catch (err) {
                console.error("PDF Parse Error", err);
                alert("Failed to parse PDF. Please try a text/csv file.");
                setIsLoading(false);
            }
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                setRawData(event.target.result);
                setShowInput(false);
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100 font-sans relative transition-colors duration-200">

            {/* HEADER */}
            <header className="bg-white dark:bg-black border-b border-red-600 dark:border-red-900 px-6 py-4 shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* LOGO REPLACEMENT */}
                        <div className="rounded-lg bg-white p-1">
                            <img src="/redwing-logo.jpg" alt="Redwing Logo" className="h-10 object-contain" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">

                        {/* VIEW TOGGLE */}
                        <div className="bg-gray-100 dark:bg-zinc-900 p-1 rounded-lg flex text-sm font-medium border border-gray-200 dark:border-zinc-700">
                            <button
                                onClick={() => setViewMode('pad')}
                                className={`px-4 py-1.5 rounded-md transition-all ${viewMode === 'pad' ? 'bg-white dark:bg-black text-red-600 dark:text-red-500 shadow-sm border border-gray-200 dark:border-zinc-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            >
                                By Pad
                            </button>
                            <button
                                onClick={() => setViewMode('aircraft')}
                                className={`px-4 py-1.5 rounded-md transition-all ${viewMode === 'aircraft' ? 'bg-white dark:bg-black text-red-600 dark:text-red-500 shadow-sm border border-gray-200 dark:border-zinc-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            >
                                By Aircraft
                            </button>
                        </div>

                        {/* DARK MODE TOGGLE */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2.5 rounded-lg bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        {import.meta.env.DEV && (
                            <button
                                onClick={() => setShowDevTools(!showDevTools)}
                                className={`p-2 rounded-lg transition-colors ${showDevTools ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                                title="Dev Tools"
                            >
                                <Bug size={20} />
                            </button>
                        )}

                        <button
                            onClick={() => setShowInput(!showInput)}
                            className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-zinc-700 text-white rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-600 transition-colors text-sm font-medium"
                        >
                            {showInput ? 'Hide Editor' : 'Edit Data'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">

                {showDevTools && (
                    <div className="mb-6 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 animate-in slide-in-from-top-2">
                        <h3 className="font-bold text-amber-800 dark:text-amber-500 mb-2 flex items-center gap-2">
                            <Bug size={16} /> Developer Tools
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setRawData(generateStressData(2000))}
                                className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-xs font-semibold transition-colors"
                            >
                                Load Stress Data (2k)
                            </button>
                            <button
                                onClick={() => setRawData(generateStressData(5000))}
                                className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-xs font-semibold transition-colors"
                            >
                                Load Heavy Stress Data (5k)
                            </button>
                            <button
                                onClick={() => setRawData(generateEdgeCaseData())}
                                className="px-3 py-1.5 bg-red-200 hover:bg-red-300 text-red-900 rounded text-xs font-semibold transition-colors"
                            >
                                Load Edge Cases
                            </button>
                            <button
                                onClick={() => setRawData('')}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                            >
                                Clear Data
                            </button>
                        </div>
                    </div>
                )}

                {showInput && (
                    <div className="mb-6 bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-md border border-gray-200 dark:border-zinc-800 animate-in slide-in-from-top-4 duration-300">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                            <Upload size={18} /> Import Schedule
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Paste your CSV/Text data below or upload a PDF/Text file.
                        </p>
                        <textarea
                            value={rawData}
                            onChange={(e) => setRawData(e.target.value)}
                            className="w-full h-48 font-mono text-xs p-4 bg-gray-50 dark:bg-black border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-y text-gray-900 dark:text-gray-100"
                            placeholder="Paste schedule data here..."
                        />
                        <div className="mt-4 flex justify-end gap-3 items-center">
                            {isLoading && <span className="text-xs text-red-600 animate-pulse font-medium">Processing PDF...</span>}
                            <label className={`flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                                {isLoading ? <Clock size={16} className="animate-spin" /> : <FileText size={16} />}
                                <span>Upload PDF/CSV</span>
                                <input type="file" className="hidden" accept=".txt,.csv,.pdf" onChange={handleFileUpload} />
                            </label>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center gap-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full">
                            <Plane size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">{flights.length}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Total Flights</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center gap-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full">
                            <ArrowUpRight size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                {flights.filter(f => f.from === 'PDR').length}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Hub Departures</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center gap-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full">
                            <ArrowDownRight size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                {flights.filter(f => f.to === 'PDR').length}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Hub Arrivals</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 flex items-center gap-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full">
                            <Users size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                {new Set([...flights.map(f => f.crew), ...flights.map(f => f.operator)]).size}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Personnel</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-800 relative">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Hub Operations (PDR)</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Visualizing departure (Takeoff) and arrival (Landing) pad occupancy at the Hub.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700">
                            <AlertCircle size={14} />
                            <span>Hover over markers for details</span>
                        </div>
                    </div>

                    <Timeline
                        flights={flights}
                        viewMode={viewMode}
                        onEventHover={(event, pos) => {
                            setHoveredEvent(event);
                            setTooltipPos(pos);
                        }}
                        onEventLeave={() => {
                            setHoveredEvent(null);
                        }}
                    />

                    <div className="mt-6 flex gap-6 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-zinc-800 pt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm border bg-emerald-500/20 border-emerald-500/30 flex items-center justify-center">
                                <div className="h-full w-0.5 bg-emerald-500"></div>
                            </div>
                            <span>Takeoff (±5m Buffer)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm border bg-red-500/20 border-red-500/30 flex items-center justify-center">
                                <div className="h-full w-0.5 bg-red-500"></div>
                            </div>
                            <span>Landing (±5m Buffer)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm border-2 border-dashed bg-yellow-500/20 border-yellow-600 flex items-center justify-center">
                            </div>
                            <span>Overlap</span>
                        </div>
                    </div>
                </div>

            </main>

            <TooltipOverlay event={hoveredEvent} position={tooltipPos} />

        </div>
    );
}
