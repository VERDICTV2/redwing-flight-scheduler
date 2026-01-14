
export const generateStressData = (count = 2000) => {
    const data = [];
    const pads = ['08L', '59N', '42C', '16D', '35H', 'AS04', 'AS05', 'AS06'];
    const aircrafts = ['AS04', 'AS05', 'AS06', 'AS08', 'VT-KIL', 'VT-JIO'];

    // Start at 08:00
    let currentTime = 8 * 60;

    for (let i = 0; i < count; i++) {
        // Random duration between 20 and 120 mins
        const duration = Math.floor(Math.random() * 100) + 20;
        const endTime = currentTime + duration;

        // Format helper
        const fmt = (m) => {
            const h = Math.floor(m / 60) % 24;
            const min = m % 60;
            return `${h.toString().padStart(2, '0')}${min.toString().padStart(2, '0')}`;
        };

        const isDep = Math.random() > 0.5;
        const pad = pads[Math.floor(Math.random() * pads.length)];
        const ac = aircrafts[Math.floor(Math.random() * aircrafts.length)];

        // CSV Format:
        // ,"FROM","TO","FROM-TIME","TO-TIME","AIRCRAFT","TAKEOFF_PAD","LANDING_PAD","OPERATOR","CREW"

        // PDR is the Hub.
        // Departure: PDR -> XYZ
        // Arrival: XYZ -> PDR

        const otherLoc = "DST";

        const row = isDep
            ? `,"PDR","${otherLoc}","PDR-${fmt(currentTime)}","${otherLoc}-${fmt(endTime)}","${ac}","${pad}","${otherLoc}","Op_${i}","Crew_${i}"`
            : `,"${otherLoc}","PDR","${otherLoc}-${fmt(currentTime)}","PDR-${fmt(endTime)}","${ac}","${otherLoc}","${pad}","Op_${i}","Crew_${i}"`;

        data.push(row);

        // Increment time slightly to spread them out, but maintain overlap
        // Advance 0-2 mins roughly every item
        if (i % 5 === 0) currentTime += 1;
        if (currentTime > 20 * 60) currentTime = 8 * 60; // Loop back to morning if we go too late
    }

    return data.join('\n');
};

export const generateEdgeCaseData = () => {
    return `
,"PDR","ARK","PDR-0900","ARK-0930","AS01","08L","59N","Standard","Flight"
,"PDR","ARK","PDR-INVALID","ARK-1000","AS02","08L","59N","Bad","Timeformat"
,"PDR","ARK","PDR-2500","ARK-2600","AS03","08L","59N","Impossible","Time"
,"PDR","ARK","PDR-0900","ARK-0905","AS04","08L","59N","Short","Flight"
,"PDR","ARK","PDR-0900","ARK-0900","AS05","08L","59N","Zero","Duration"
,"PDR","ARK","PDR-0900","ARK-0830","AS06","08L","59N","Negative","Duration"
,"???","???","???-0900","???-1000","AS07","08L","59N","Missing","Locs"
,,,,,,,,,
,"PDR","ARK","PDR-1200","ARK-1230","AS08","","59N","Missing","Pad"
    `.trim();
};
