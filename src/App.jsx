<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>GIS Kelurahan - Peta Jalan</title>
    
    <!-- Memuat Tailwind CSS untuk Desain -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Memuat Phosphor Icons untuk Ikon -->
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    
    <!-- Memuat Leaflet untuk Peta -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    
    <!-- Memuat React dan Babel untuk Logika Aplikasi -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    
    <!-- Memuat Supabase -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

    <style>
        .custom-leaflet-icon { background: transparent; border: none; }
        /* Mencegah zoom layar di HP saat mengetik */
        input, select, textarea { font-size: 16px !important; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased overflow-hidden">
    <div id="root"></div>

    <script type="text/babel">
        const { useState, useEffect, useRef } = React;

        // --- HELPER FUNCTIONS ---
        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3; const φ1 = lat1 * Math.PI/180; const φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2-lat1) * Math.PI/180; const Δλ = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        };

        const calculateTotalDistance = (pathArray) => {
            let total = 0;
            for(let i = 1; i < pathArray.length; i++){
                total += calculateDistance(pathArray[i-1][0], pathArray[i-1][1], pathArray[i][0], pathArray[i][1]);
            }
            return total;
        };

        // --- KOMPONEN UTAMA APLIKASI ---
        function App() {
            const [activeTab, setActiveTab] = useState('map'); 
            const [roadsData, setRoadsData] = useState([]);
            const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
            
            // Database Settings State
            const [showDbSettings, setShowDbSettings] = useState(false);
            const [dbUrl, setDbUrl] = useState(localStorage.getItem('sb_url') || '');
            const [dbKey, setDbKey] = useState(localStorage.getItem('sb_key') || '');
            const [supabaseClient, setSupabaseClient] = useState(null);

            const showToast = (message, type = 'info') => {
                setToast({ show: true, message, type });
                setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
            };

            // Initialize Supabase Client
            useEffect(() => {
                if (dbUrl && dbKey) {
                    try {
                        const client = window.supabase.createClient(dbUrl, dbKey);
                        setSupabaseClient(client);
                    } catch (e) {
                        console.error("Gagal konek supabase", e);
                        setSupabaseClient(null);
                    }
                } else {
                    setSupabaseClient(null);
                }
            }, [dbUrl, dbKey]);

            // Fetch Data
            useEffect(() => {
                const fetchRoads = async () => {
                    if (!supabaseClient) { setRoadsData([]); return; }
                    const { data, error } = await supabaseClient.from('roads').select('*').order('created_at', { ascending: false });
                    if (!error && data) setRoadsData(data);
                };
                fetchRoads();

                if (!supabaseClient) return;
                const subscription = supabaseClient.channel('public:roads')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'roads' }, fetchRoads).subscribe();
                return () => supabaseClient.removeChannel(subscription);
            }, [supabaseClient]);

            const saveDbSettings = () => {
                localStorage.setItem('sb_url', dbUrl);
                localStorage.setItem('sb_key', dbKey);
                setShowDbSettings(false);
                showToast("Pengaturan Database Disimpan!", "success");
                setTimeout(() => window.location.reload(), 1000);
            };

            // --- KOMPONEN MAP PICKER (Titik Lokasi) ---
            const MapPicker = ({ initialLat, initialLng, onSelect, onClose }) => {
                const mapRef = useRef(null); const mapInstance = useRef(null); const markerRef = useRef(null);
                
                useEffect(() => {
                    let timeoutId;
                    if (!mapInstance.current) {
                        mapInstance.current = L.map(mapRef.current, { zoomControl: false }).setView([-0.485, 117.155], 14);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
                        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
                        
                        const defaultCenter = [-0.485, 117.155];
                        const markerPos = (initialLat && initialLng) ? [initialLat, initialLng] : defaultCenter;
                        markerRef.current = L.marker(markerPos, { draggable: true }).addTo(mapInstance.current);

                        timeoutId = setTimeout(() => { 
                            if (mapInstance.current && mapInstance.current._container) {
                                mapInstance.current.invalidateSize(); 
                                mapInstance.current.setView(markerPos, 16); 
                            }
                        }, 250);

                        mapInstance.current.on('click', (e) => {
                            markerRef.current.setLatLng(e.latlng);
                            onSelect(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
                            onClose();
                        });
                    }
                    return () => { 
                        if (timeoutId) clearTimeout(timeoutId);
                        if (mapInstance.current) {
                            mapInstance.current.remove(); 
                            mapInstance.current = null;
                        }
                    };
                }, []); // Init only once

                return (
                    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shadow-md">
                            <h3 className="font-bold text-lg">Pilih Titik Lokasi</h3>
                            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full"><i class="ph ph-x text-xl"></i></button>
                        </div>
                        <div className="bg-blue-50 p-3 text-sm text-blue-800 text-center font-medium shadow-inner">Sentuh area peta untuk memindahkan Pin.</div>
                        <div className="flex-1 relative"><div ref={mapRef} style={{ height: '100%', width: '100%' }}></div></div>
                        <div className="p-4 bg-white border-t">
                            <button onClick={() => { const pos = markerRef.current.getLatLng(); onSelect(pos.lat.toFixed(6), pos.lng.toFixed(6)); onClose(); }} 
                                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 text-lg">
                                <i class="ph ph-map-pin text-xl"></i> Gunakan Titik Ini
                            </button>
                        </div>
                    </div>
                );
            };

            // --- KOMPONEN TRACK CREATOR (Editor Jalur) ---
            const TrackCreator = ({ initialPath, onSave, onClose }) => {
                const mapRef = useRef(null); const mapInstance = useRef(null); 
                const polylineRef = useRef(null); const markerStartRef = useRef(null); const markerEndRef = useRef(null);
                const watchIdRef = useRef(null);
                const [points, setPoints] = useState(initialPath || []);
                const [mode, setMode] = useState('manual');
                const modeRef = useRef('manual');
                const [isGpsRecording, setIsGpsRecording] = useState(false);

                useEffect(() => { modeRef.current = mode; }, [mode]);

                useEffect(() => {
                    let timeoutId;
                    if (!mapInstance.current) {
                        mapInstance.current = L.map(mapRef.current, { zoomControl: false }).setView([-0.485, 117.155], 15);
                        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
                        const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
                        osm.addTo(mapInstance.current);
                        L.control.layers({ "Peta Jalan": osm, "Satelit": esri }).addTo(mapInstance.current);
                        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

                        mapInstance.current.on('click', (e) => {
                            if (modeRef.current === 'manual') setPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
                        });

                        timeoutId = setTimeout(() => {
                            if (mapInstance.current && mapInstance.current._container) {
                                mapInstance.current.invalidateSize();
                                if (points.length > 0) mapInstance.current.fitBounds(L.polyline(points).getBounds(), { padding: [20, 20] });
                            }
                        }, 300);
                    }
                    return () => { 
                        if (timeoutId) clearTimeout(timeoutId);
                        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
                        if (mapInstance.current) { 
                            mapInstance.current.remove(); 
                            mapInstance.current = null; 
                        } 
                    };
                }, []);

                useEffect(() => {
                    if (!mapInstance.current) return;
                    if (polylineRef.current) mapInstance.current.removeLayer(polylineRef.current);
                    if (markerStartRef.current) mapInstance.current.removeLayer(markerStartRef.current);
                    if (markerEndRef.current) mapInstance.current.removeLayer(markerEndRef.current);

                    if (points.length > 0) {
                        polylineRef.current = L.polyline(points, { color: '#3b82f6', weight: 6, opacity: 0.9 }).addTo(mapInstance.current);
                        markerStartRef.current = L.circleMarker(points[0], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapInstance.current); 
                        if (points.length > 1) {
                            markerEndRef.current = L.circleMarker(points[points.length - 1], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapInstance.current);
                        }
                    }
                }, [points]);

                const toggleGps = () => {
                    if (isGpsRecording) {
                        navigator.geolocation.clearWatch(watchIdRef.current);
                        setIsGpsRecording(false); setMode('manual');
                        showToast("Perekaman GPS dihentikan.", "info");
                    } else {
                        if (!navigator.geolocation) return showToast("GPS tidak didukung", "error");
                        setMode('gps'); setIsGpsRecording(true);
                        showToast("GPS Aktif. Bergeraklah untuk merekam jalur.", "success");
                        watchIdRef.current = navigator.geolocation.watchPosition(
                            (pos) => {
                                const { latitude, longitude, accuracy } = pos.coords;
                                if (accuracy > 50) return; 
                                const newPoint = [latitude, longitude];
                                setPoints(prev => {
                                    if (prev.length > 0 && calculateDistance(prev[prev.length-1][0], prev[prev.length-1][1], latitude, longitude) < 2) return prev;
                                    return [...prev, newPoint];
                                });
                                mapInstance.current.setView(newPoint, 18);
                            },
                            (err) => { showToast("GPS Error", "error"); setIsGpsRecording(false); setMode('manual'); },
                            { enableHighAccuracy: true, timeout: 5000 }
                        );
                    }
                };

                return (
                    <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col font-sans">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shadow-md z-10">
                            <div><h3 className="font-bold text-lg">Editor Rute</h3><span className="text-[11px] text-slate-300">{(calculateTotalDistance(points)/1000).toFixed(2)} KM | {points.length} Titik</span></div>
                            <button onClick={onClose} className="p-2 bg-slate-800 rounded-full"><i class="ph ph-x"></i></button>
                        </div>
                        <div className="flex-1 relative">
                            <div ref={mapRef} style={{ height: '100%', width: '100%' }}></div>
                            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000]">
                                <div className="bg-white/90 px-4 py-2 rounded-full shadow-lg border font-bold text-sm text-slate-700 flex items-center gap-2">
                                    <i class={`ph ph-navigation-arrow ${isGpsRecording ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}></i>
                                    {isGpsRecording ? 'Merekam GPS...' : (mode === 'manual' ? 'Sentuh Peta' : 'Siap')}
                                </div>
                            </div>
                            <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-3">
                                <button onClick={() => setPoints(p => p.slice(0, -1))} disabled={points.length===0} className="bg-white p-3 rounded-xl shadow-lg text-slate-700"><i class="ph ph-arrow-u-up-left text-xl"></i></button>
                                {points.length > 0 && <button onClick={() => setPoints([])} className="bg-white p-3 rounded-xl shadow-lg text-red-500"><i class="ph ph-trash text-xl"></i></button>}
                            </div>
                        </div>
                        <div className="bg-white border-t pb-2 z-10 shadow-lg">
                            <div className="flex p-3 gap-3">
                                <button onClick={() => { setMode('manual'); if(isGpsRecording) toggleGps(); }} className={`flex-1 flex flex-col items-center p-3 rounded-xl font-bold text-sm border ${mode === 'manual' && !isGpsRecording ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white'}`}><i class="ph ph-cursor-click text-2xl mb-1"></i> Manual</button>
                                <button onClick={toggleGps} className={`flex-1 flex flex-col items-center p-3 rounded-xl font-bold text-sm border ${isGpsRecording ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-white'}`}><i class="ph ph-activity text-2xl mb-1"></i> {isGpsRecording ? 'Stop GPS' : 'Rekam GPS'}</button>
                            </div>
                            <div className="px-3"><button onClick={() => onSave(points)} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2"><i class="ph ph-check-circle text-xl"></i> Simpan Jalur</button></div>
                        </div>
                    </div>
                );
            };

            const MiniMap = ({ path }) => {
                const mapRef = useRef(null); const mapInstance = useRef(null); const polylineRef = useRef(null);
                
                // Initialize map once
                useEffect(() => {
                    if (!mapInstance.current) {
                        const startCenter = path && path.length > 0 ? path[0] : [-0.485, 117.155];
                        mapInstance.current = L.map(mapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView(startCenter, 15);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
                    }
                    return () => {
                        if (mapInstance.current) {
                            mapInstance.current.remove();
                            mapInstance.current = null;
                        }
                    };
                }, []);

                // Update polyline on path change
                useEffect(() => {
                    if (!mapInstance.current || !path || path.length === 0) return;
                    if (polylineRef.current) mapInstance.current.removeLayer(polylineRef.current);
                    polylineRef.current = L.polyline(path, { color: '#3b82f6', weight: 4 }).addTo(mapInstance.current);
                    mapInstance.current.fitBounds(polylineRef.current.getBounds(), { padding: [10, 10] });
                }, [path]);

                return <div ref={mapRef} className="h-full w-full rounded-xl pointer-events-none" />;
            };

            // --- FORM INPUT UTAMA ---
            const UnifiedForm = () => {
                const [showPointPicker, setShowPointPicker] = useState(false);
                const [showTrackCreator, setShowTrackCreator] = useState(false);
                const [isSaving, setIsSaving] = useState(false);
                const [formData, setFormData] = useState({ roadName: '', condition: 'Baik', description: '', photos: [], surfaceTypes: [], lat: '', lng: '' });
                const [path, setPath] = useState([]);

                const handlePhotoUpload = (e) => {
                    Array.from(e.target.files).forEach(file => {
                        if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const img = new Image();
                                img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    const scale = img.width > 800 ? 800 / img.width : 1;
                                    canvas.width = img.width * scale; canvas.height = img.height * scale;
                                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                    setFormData(prev => ({ ...prev, photos: [...prev.photos, canvas.toDataURL('image/jpeg', 0.6)] }));
                                };
                                img.src = event.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                };

                const toggleSurface = (tipe) => {
                    setFormData(prev => ({ ...prev, surfaceTypes: prev.surfaceTypes.includes(tipe) ? prev.surfaceTypes.filter(t => t !== tipe) : [...prev.surfaceTypes, tipe] }));
                };

                const getGPS = () => {
                    navigator.geolocation.getCurrentPosition(
                        pos => { setFormData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude })); showToast("Lokasi didapat!", "success"); },
                        err => showToast(`Gagal GPS: ${err.message}`, "error"), { enableHighAccuracy: true }
                    );
                };

                const handleSubmit = async (e) => {
                    e.preventDefault();
                    if (!formData.roadName) return showToast("Nama jalan wajib diisi", "error");
                    if (!formData.lat && !formData.lng && path.length < 2) return showToast("Isi Titik Lokasi atau Rekam Track GPS", "error");

                    const basePayload = {
                        roadName: formData.roadName, condition: formData.condition, year: new Date().getFullYear(),
                        surfaceTypes: formData.surfaceTypes, description: formData.description,
                        photos: formData.photos, surveyDate: new Date().toISOString()
                    };

                    if (path.length >= 2) { basePayload.trackPath = path; basePayload.distanceMeters = Math.round(calculateTotalDistance(path)); }
                    if (formData.lat && formData.lng) { basePayload.location = { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) }; }

                    setIsSaving(true);
                    try {
                        if (!supabaseClient) {
                            setRoadsData(prev => [{ ...basePayload, id: Date.now(), created_at: new Date().toISOString() }, ...prev]);
                            showToast("Disimpan Lokal (Mode Preview)", "success");
                        } else {
                            const { error } = await supabaseClient.from('roads').insert([basePayload]);
                            if (error) throw error;
                            showToast("Berhasil disimpan ke Database!", "success");
                        }
                        setFormData({ roadName: '', condition: 'Baik', description: '', photos: [], surfaceTypes: [], lat: '', lng: '' });
                        setPath([]); setActiveTab('map');
                    } catch (err) { showToast(`Error: ${err.message}`, "error"); } 
                    finally { setIsSaving(false); }
                };

                return (
                    <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6 max-w-2xl mx-auto pb-36">
                        <h2 className="text-2xl font-bold border-b pb-3 text-slate-800">Input Data Jalan</h2>

                        <div className="space-y-3"><label className="font-bold text-slate-700">1. Titik Lokasi Pusat</label>
                            <div className="flex gap-3">
                                <button type="button" onClick={getGPS} className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-xl font-bold flex justify-center items-center gap-2"><i class="ph ph-navigation-arrow text-lg"></i> Deteksi</button>
                                <button type="button" onClick={() => setShowPointPicker(true)} className="flex-1 bg-white border border-slate-300 py-3 rounded-xl font-bold flex justify-center items-center gap-2"><i class="ph ph-map-pin text-lg"></i> Peta</button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input type="number" step="any" placeholder="Latitude" className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} />
                                <input type="number" step="any" placeholder="Longitude" className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} />
                            </div>
                        </div>

                        <div className="space-y-3"><label className="font-bold text-slate-700">2. Nama Jalan *</label>
                            <input required type="text" placeholder="Cth: Jl. Ahmad Yani" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.roadName} onChange={e => setFormData({...formData, roadName: e.target.value})} />
                        </div>

                        <div className="space-y-3"><label className="font-bold text-slate-700">3. Kondisi Jalan</label>
                            <select className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})}>
                                <option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
                            </select>
                        </div>

                        <div className="space-y-3"><label className="font-bold text-slate-700">4. Jenis Permukaan</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Aspal', 'Beton', 'Tanah', 'Paving Block', 'Berbatuan', 'Lainnya'].map(tipe => (
                                    <label key={tipe} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${formData.surfaceTypes.includes(tipe) ? 'bg-blue-50 border-blue-300 font-bold' : 'bg-white'}`}>
                                        <input type="checkbox" checked={formData.surfaceTypes.includes(tipe)} onChange={() => toggleSurface(tipe)} className="w-4 h-4 accent-blue-600" /> {tipe}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3"><label className="font-bold text-slate-700">5. Keterangan Tambahan</label>
                            <textarea rows="3" placeholder="Opsional..." className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                        </div>

                        <div className="space-y-3"><label className="font-bold text-slate-700">6. Foto Dokumentasi</label>
                            <div className="flex flex-wrap gap-3">
                                {formData.photos.map((p, i) => (
                                    <div key={i} className="relative w-20 h-20 border rounded-xl overflow-hidden"><img src={p} className="w-full h-full object-cover" /><button type="button" onClick={() => setFormData(prev => ({...prev, photos: prev.photos.filter((_, idx)=>idx!==i)}))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><i class="ph ph-x"></i></button></div>
                                ))}
                                <label className="w-20 h-20 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl flex flex-col items-center justify-center text-blue-500 cursor-pointer">
                                    <i class="ph ph-camera text-2xl"></i><span className="text-[10px] font-bold">Tambah</span>
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-3"><label className="font-bold text-slate-700">7. Editor Jalur (Track Rute)</label>
                            <div className="bg-slate-50 border p-4 rounded-2xl text-center">
                                {path.length === 0 ? (
                                    <>
                                        <i class="ph ph-activity text-3xl text-slate-400 mb-2"></i><p className="text-sm text-slate-500 mb-4">Belum ada jalur rute dibuat.</p>
                                        <button type="button" onClick={() => setShowTrackCreator(true)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2"><i class="ph ph-map-trifold text-lg"></i> Buka Editor Rute (Manual/GPS)</button>
                                    </>
                                ) : (
                                    <div className="text-left">
                                        <div className="flex justify-between items-center mb-2">
                                            <div><div className="text-xl font-bold">{(calculateTotalDistance(path)/1000).toFixed(2)} KM</div><span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded">✓ {path.length} Titik</span></div>
                                            <button type="button" onClick={() => setShowTrackCreator(true)} className="border px-3 py-1 rounded-lg text-xs font-bold bg-white">Edit</button>
                                        </div>
                                        <div className="h-24 rounded-xl overflow-hidden border"><MiniMap path={path} /></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button disabled={isSaving} type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 shadow-lg disabled:opacity-50"><i class="ph ph-floppy-disk text-xl"></i> {isSaving ? 'Menyimpan...' : 'Simpan Data Peta'}</button>
                        
                        {showPointPicker && <MapPicker initialLat={formData.lat} initialLng={formData.lng} onSelect={(lat, lng) => {setFormData({...formData, lat, lng}); setShowPointPicker(false);}} onClose={() => setShowPointPicker(false)} />}
                        {showTrackCreator && <TrackCreator initialPath={path} onSave={(newPath) => {setPath(newPath); setShowTrackCreator(false);}} onClose={() => setShowTrackCreator(false)} />}
                    </form>
                );
            };

            // --- TAMPILAN PETA (MAP VIEW) ---
            const MapView = () => {
                const mapRef = useRef(null); 
                const mapInstance = useRef(null); 
                const markersGroup = useRef(null);
                const [filterCond, setFilterCond] = useState('Semua');
                const filteredRoads = roadsData.filter(r => filterCond === 'Semua' ? true : r.condition === filterCond);

                // Initialize map once
                useEffect(() => {
                    let timeoutId;
                    if (!mapInstance.current) {
                        mapInstance.current = L.map(mapRef.current, { zoomControl: false }).setView([-0.485, 117.155], 14);
                        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
                        const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(mapInstance.current);
                        L.control.zoom({ position: 'topleft' }).addTo(mapInstance.current);
                        L.control.layers({ "Peta Jalan": osm, "Satelit": esri }).addTo(mapInstance.current);
                        
                        markersGroup.current = L.layerGroup().addTo(mapInstance.current);

                        timeoutId = setTimeout(() => {
                            if (mapInstance.current && mapInstance.current._container) {
                                mapInstance.current.invalidateSize();
                            }
                        }, 200);
                    }

                    return () => {
                        if (timeoutId) clearTimeout(timeoutId);
                        if (mapInstance.current) {
                            mapInstance.current.remove();
                            mapInstance.current = null;
                        }
                    };
                }, []);

                // Update markers on data/filter change
                useEffect(() => {
                    if (!mapInstance.current || !markersGroup.current) return;
                    markersGroup.current.clearLayers();

                    const icons = { 'Baik': '#22c55e', 'Sedang': '#eab308', 'Rusak Ringan': '#f97316', 'Rusak Berat': '#ef4444' };
                    
                    filteredRoads.forEach(road => {
                        const color = icons[road.condition] || '#3b82f6';
                        const popup = `<div style="min-width:200px">
                            <h3 style="font-weight:bold; font-size:16px; margin-bottom:8px">${road.roadName}</h3>
                            <div style="font-size:12px; margin-bottom:8px">Kondisi: <b>${road.condition}</b><br/>Tahun: ${road.year}</div>
                            ${road.photos && road.photos.length ? `<img src="${road.photos[0]}" style="width:100%; height:100px; object-fit:cover; border-radius:8px"/>` : ''}
                        </div>`;

                        if (road.trackPath && road.trackPath.length) {
                            L.polyline(road.trackPath, { color, weight: 6 }).bindPopup(popup).addTo(markersGroup.current);
                        }
                        if (road.location && road.location.lat) {
                            const customIcon = L.divIcon({ className: 'custom-leaflet-icon', html: `<div style="background:${color}; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`, iconSize: [20,20], iconAnchor: [10,10] });
                            L.marker([road.location.lat, road.location.lng], { icon: customIcon }).bindPopup(popup).addTo(markersGroup.current);
                        }
                    });
                }, [filteredRoads]);

                return (
                    <div className="absolute inset-0 w-full h-full">
                        <div className="absolute top-3 right-3 z-[1000] bg-white p-2 rounded-xl shadow-lg border">
                            <select className="text-sm p-1 outline-none font-bold text-slate-700 bg-transparent" value={filterCond} onChange={e=>setFilterCond(e.target.value)}>
                                <option>Semua</option><option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
                            </select>
                        </div>
                        <div className="absolute bottom-6 left-3 z-[1000] bg-white p-3 rounded-xl shadow-lg text-xs font-bold border min-w-[130px]">
                            <div className="mb-2 border-b pb-1">Legenda Peta</div>
                            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]"></div> Baik</div> <span>{filteredRoads.filter(r=>r.condition==='Baik').length}</span></div>
                            <div className="flex justify-between items-center mt-1"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div> Sedang</div> <span>{filteredRoads.filter(r=>r.condition==='Sedang').length}</span></div>
                            <div className="flex justify-between items-center mt-1"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f97316]"></div> R. Ringan</div> <span>{filteredRoads.filter(r=>r.condition==='Rusak Ringan').length}</span></div>
                            <div className="flex justify-between items-center mt-1"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div> R. Berat</div> <span>{filteredRoads.filter(r=>r.condition==='Rusak Berat').length}</span></div>
                        </div>
                        <div ref={mapRef} className="w-full h-full z-0"></div>
                    </div>
                );
            };

            return (
                <div className="flex flex-col h-[100dvh] w-full relative">
                    {/* Header Utama */}
                    <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-20">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-500 p-2 rounded-lg"><i class="ph ph-map-pin-line text-xl"></i></div>
                            <div><h1 className="font-extrabold leading-tight">GIS Kelurahan</h1><span className="text-[10px] text-blue-200 block">Sistem Pemetaan Jalan</span></div>
                        </div>
                        <button onClick={() => setShowDbSettings(true)} className="bg-slate-800 p-2 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-2">
                            <i class="ph ph-database"></i> {supabaseClient ? <span className="text-green-400">Online</span> : <span className="text-yellow-400">Offline/Lokal</span>}
                        </button>
                    </header>

                    {/* Area Konten */}
                    <main className="flex-1 relative overflow-y-auto bg-white">
                        {activeTab === 'map' ? <MapView /> : <UnifiedForm />}
                    </main>

                    {/* Navigasi Bawah */}
                    <nav className="bg-white border-t flex justify-around p-2 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20">
                        <button onClick={() => setActiveTab('map')} className={`flex-1 flex flex-col items-center py-2 rounded-xl font-bold transition-colors ${activeTab === 'map' ? 'text-blue-700 bg-blue-50' : 'text-slate-400'}`}>
                            <i class="ph ph-map-trifold text-2xl mb-1"></i> <span className="text-[10px]">Lihat Peta</span>
                        </button>
                        <button onClick={() => setActiveTab('input')} className={`flex-1 flex flex-col items-center py-2 rounded-xl font-bold transition-colors ${activeTab === 'input' ? 'text-blue-700 bg-blue-50' : 'text-slate-400'}`}>
                            <i class="ph ph-plus-square text-2xl mb-1"></i> <span className="text-[10px]">Input Data</span>
                        </button>
                    </nav>

                    {/* Modal Pengaturan Database */}
                    {showDbSettings && (
                        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                                <h2 className="text-xl font-extrabold mb-1">Pengaturan Database</h2>
                                <p className="text-xs text-slate-500 mb-5">Sambungkan ke Supabase agar data tersimpan permanen.</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Supabase URL</label>
                                        <input type="text" value={dbUrl} onChange={e=>setDbUrl(e.target.value)} placeholder="https://xxxx.supabase.co" className="w-full p-3 border rounded-xl bg-slate-50 text-sm outline-none focus:border-blue-500"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Supabase Anon Key</label>
                                        <input type="password" value={dbKey} onChange={e=>setDbKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1..." className="w-full p-3 border rounded-xl bg-slate-50 text-sm outline-none focus:border-blue-500"/>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={()=>setShowDbSettings(false)} className="flex-1 p-3 rounded-xl font-bold text-slate-600 bg-slate-100">Batal</button>
                                        <button onClick={saveDbSettings} className="flex-1 p-3 rounded-xl font-bold text-white bg-blue-600">Simpan & Muat Ulang</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifikasi Toast */}
                    {toast.show && (
                        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[99999] px-5 py-3 rounded-full text-sm font-bold text-white shadow-xl flex items-center gap-2 w-max max-w-[90%] ${toast.type==='error'?'bg-red-600':'bg-emerald-600'}`}>
                            {toast.message}
                        </div>
                    )}
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>
