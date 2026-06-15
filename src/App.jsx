import React, { useState, useEffect, useRef } from 'react';
import { 
  Map as MapIcon, PlusSquare, Navigation, Save, 
  Wifi, Camera, MapPin, Activity, X, Download, Loader, MousePointerClick, Undo2, CheckCircle2
} from 'lucide-react';

// --- SUPABASE INITIALIZATION ---
// PENTING: Saat Anda menyalin kode ini ke project Vite Anda di komputer, 
// silakan HAPUS tanda komentar (//) pada 4 baris kode di bawah ini:

// import { createClient } from '@supabase/supabase-js';
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Untuk keperluan preview di halaman ini agar tidak terjadi error kompilasi:
const supabase = null;

// --- HELPER FUNCTIONS ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
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

// --- MAIN APPLICATION COMPONENT ---
export default function App() {
  const [activeTab, setActiveTab] = useState('map'); 
  const [roadsData, setRoadsData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    if (window.L) { setLeafletLoaded(true); return; }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true); document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const fetchRoads = async () => {
      if (!supabase) { setRoadsData([]); return; }
      const { data, error } = await supabase.from('roads').select('*').order('created_at', { ascending: false });
      if (!error) setRoadsData(data || []);
    };
    fetchRoads();
    if (!supabase) return;
    const subscription = supabase.channel('public:roads').on('postgres_changes', { event: '*', schema: 'public', table: 'roads' }, fetchRoads).subscribe();
    return () => supabase.removeChannel(subscription);
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };

  // --- KOMPONEN MAP PICKER (Titik Lokasi) ---
  const MapPicker = ({ initialLat, initialLng, onSelect, onClose }) => {
    const mapRef = useRef(null); const mapInstance = useRef(null); const markerRef = useRef(null);

    useEffect(() => {
      if (!window.L || !mapRef.current) return;
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView([-0.485, 117.155], 14);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
        window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        
        const defaultCenter = [-0.485, 117.155];
        const markerPos = (initialLat && initialLng) ? [initialLat, initialLng] : defaultCenter;
        markerRef.current = window.L.marker(markerPos, { draggable: true }).addTo(mapInstance.current);

        setTimeout(() => { if (mapInstance.current) { mapInstance.current.invalidateSize(); mapInstance.current.setView(markerPos, 16); } }, 250);

        mapInstance.current.on('click', (e) => {
          if (markerRef.current) markerRef.current.setLatLng(e.latlng);
          onSelect(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
          onClose();
        });
      }
      return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
    }, [initialLat, initialLng]);

    return (
      <div className="fixed top-0 left-0 right-0 bottom-0 h-[100dvh] z-[9999] bg-white flex flex-col">
        <div className="p-4 pt-[max(env(safe-area-inset-top),1rem)] bg-slate-900 text-white flex justify-between items-center shadow-md">
          <h3 className="font-bold text-lg">Pilih Titik Lokasi</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full active:scale-95 transition-transform"><X size={24}/></button>
        </div>
        <div className="bg-blue-50 p-3 text-sm text-blue-800 text-center border-b border-blue-100 font-medium shadow-inner">
          Sentuh area peta untuk memindahkan titik (Pin).
        </div>
        <div className="flex-1 relative"><div ref={mapRef} style={{ height: '100%', width: '100%' }}></div></div>
        <div className="p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] bg-white border-t shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
          <button type="button" onClick={() => { if(markerRef.current){ const pos = markerRef.current.getLatLng(); onSelect(pos.lat.toFixed(6), pos.lng.toFixed(6)); } onClose(); }} 
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 text-lg active:scale-[0.98] transition-transform shadow-lg shadow-blue-200">
            <MapPin size={22} /> Gunakan Titik Ini
          </button>
        </div>
      </div>
    );
  };

  // --- KOMPONEN TRACK CREATOR (Editor Jalur Modern) ---
  const TrackCreator = ({ initialPath, onSave, onClose }) => {
    const mapRef = useRef(null); const mapInstance = useRef(null); 
    const polylineRef = useRef(null); const markerStartRef = useRef(null); const markerEndRef = useRef(null);
    const watchIdRef = useRef(null);

    const [points, setPoints] = useState(initialPath || []);
    const pointsRef = useRef(initialPath || []);
    const [mode, setMode] = useState('manual'); // 'manual' | 'gps'
    const modeRef = useRef('manual');
    const [isGpsRecording, setIsGpsRecording] = useState(false);

    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { pointsRef.current = points; }, [points]);

    // Inisialisasi Peta
    useEffect(() => {
      if (!window.L || !mapRef.current) return;
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView([-0.485, 117.155], 15);
        
        const osm = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
        const esri = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
        osm.addTo(mapInstance.current);
        window.L.control.layers({ "Peta Jalan": osm, "Satelit": esri }).addTo(mapInstance.current);
        window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

        // Event Klik Peta untuk Mode Manual
        mapInstance.current.on('click', (e) => {
          if (modeRef.current === 'manual') {
            const newPoint = [e.latlng.lat, e.latlng.lng];
            setPoints(prev => [...prev, newPoint]);
          }
        });

        setTimeout(() => {
          if (mapInstance.current) {
            mapInstance.current.invalidateSize();
            if (points.length > 0) mapInstance.current.fitBounds(window.L.polyline(points).getBounds(), { padding: [20, 20] });
          }
        }, 300);
      }

      return () => { 
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
        if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } 
      };
    }, []);

    // Gambar Garis & Marker saat points berubah
    useEffect(() => {
      if (!mapInstance.current || !window.L) return;
      if (polylineRef.current) mapInstance.current.removeLayer(polylineRef.current);
      if (markerStartRef.current) mapInstance.current.removeLayer(markerStartRef.current);
      if (markerEndRef.current) mapInstance.current.removeLayer(markerEndRef.current);

      if (points.length > 0) {
        polylineRef.current = window.L.polyline(points, { color: '#3b82f6', weight: 6, opacity: 0.9 }).addTo(mapInstance.current);
        markerStartRef.current = window.L.circleMarker(points[0], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapInstance.current); // Hijau untuk Start
        
        if (points.length > 1) {
          markerEndRef.current = window.L.circleMarker(points[points.length - 1], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapInstance.current); // Merah untuk End
        }
      }
    }, [points]);

    // Logika GPS Tracking
    const toggleGps = () => {
      if (isGpsRecording) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        setIsGpsRecording(false);
        setMode('manual');
        showToast("Perekaman GPS dihentikan.", "info");
      } else {
        if (!navigator.geolocation) return showToast("GPS tidak didukung", "error");
        setMode('gps');
        setIsGpsRecording(true);
        showToast("GPS Aktif. Bergeraklah untuk merekam jalur.", "success");

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            if (accuracy > 50) return; // Abaikan jika akurasi sangat buruk (>50m)
            const newPoint = [latitude, longitude];
            
            setPoints(prev => {
              if (prev.length > 0) {
                const lastPoint = prev[prev.length - 1];
                const dist = calculateDistance(lastPoint[0], lastPoint[1], latitude, longitude);
                if (dist < 2) return prev; // Abaikan jika bergerak kurang dari 2 meter (cegah garis kusut)
              }
              return [...prev, newPoint];
            });

            if (mapInstance.current) mapInstance.current.setView(newPoint, 18);
          },
          (err) => {
            showToast("GPS Error: " + err.message, "error");
            setIsGpsRecording(false);
            setMode('manual');
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }
    };

    const undo = () => { if (points.length > 0) setPoints(prev => prev.slice(0, -1)); };
    const clearAll = () => { if(window.confirm('Hapus semua titik jalur?')) setPoints([]); };

    return (
      <div className="fixed top-0 left-0 right-0 bottom-0 h-[100dvh] z-[9999] bg-slate-50 flex flex-col font-sans">
        {/* Header */}
        <div className="p-4 pt-[max(env(safe-area-inset-top),1rem)] bg-slate-900 text-white flex justify-between items-center shadow-md z-10">
          <div>
            <h3 className="font-bold text-lg leading-tight">Editor Rute</h3>
            <span className="text-[11px] text-slate-300">{(calculateTotalDistance(points) / 1000).toFixed(2)} KM | {points.length} Titik</span>
          </div>
          <button type="button" onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full active:scale-95 transition-transform"><X size={20}/></button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapRef} style={{ height: '100%', width: '100%' }}></div>
          
          {/* Top Floating Controls */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex gap-2">
             <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-200 font-bold text-sm text-slate-700 flex items-center gap-2">
                <Navigation size={16} className={isGpsRecording ? 'text-red-500 animate-pulse' : 'text-blue-500'} />
                {isGpsRecording ? 'Merekam GPS...' : (mode === 'manual' ? 'Mode Gambar (Sentuh Peta)' : 'Menunggu Instruksi')}
             </div>
          </div>

          {/* Right Floating Controls */}
          <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-3">
             <button onClick={undo} disabled={points.length === 0} className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-slate-700 active:scale-95 disabled:opacity-50 transition-transform">
               <Undo2 size={24} />
             </button>
             {points.length > 0 && (
               <button onClick={clearAll} className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-red-500 active:scale-95 transition-transform">
                 <X size={24} />
               </button>
             )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="bg-white border-t border-slate-200 pb-[max(env(safe-area-inset-bottom),0.5rem)] z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
           <div className="flex p-3 gap-3">
              <button onClick={() => { setMode('manual'); if(isGpsRecording) toggleGps(); }} 
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl font-bold text-sm transition-all shadow-sm border ${mode === 'manual' && !isGpsRecording ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                <MousePointerClick size={22} className="mb-1" /> Gambar Manual
              </button>
              <button onClick={toggleGps} 
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl font-bold text-sm transition-all shadow-sm border ${isGpsRecording ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-white border-slate-200 text-slate-500'}`}>
                <Activity size={22} className="mb-1" /> {isGpsRecording ? 'Stop GPS' : 'Rekam via GPS'}
              </button>
           </div>
           <div className="px-3 pb-3">
              <button onClick={() => onSave(points)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-lg flex justify-center items-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/30">
                <CheckCircle2 size={22} /> Simpan Jalur Ini
              </button>
           </div>
        </div>
      </div>
    );
  };

  const MiniMap = ({ path }) => {
    const mapRef = useRef(null); const mapInstance = useRef(null); const polylineRef = useRef(null);
    useEffect(() => {
      if (!window.L || !mapRef.current || path.length === 0) return;
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView(path[0], 15);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
      }
      if (polylineRef.current) mapInstance.current.removeLayer(polylineRef.current);
      polylineRef.current = window.L.polyline(path, { color: '#3b82f6', weight: 4 }).addTo(mapInstance.current);
      mapInstance.current.fitBounds(polylineRef.current.getBounds(), { padding: [10, 10] });
    }, [path]);
    return <div ref={mapRef} className="h-full w-full rounded-xl z-0 pointer-events-none" />;
  };

  const UnifiedForm = () => {
    const [showPointPicker, setShowPointPicker] = useState(false);
    const [showTrackCreator, setShowTrackCreator] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
      roadName: '', condition: 'Baik',
      description: '', photos: [], surfaceTypes: [],
      lat: '', lng: '', accuracy: 0
    });
    const [path, setPath] = useState([]); // Array of [lat, lng]

    const handlePhotoUpload = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800; let scaleSize = 1;
              if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
              canvas.width = img.width * scaleSize; canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const base64 = canvas.toDataURL('image/jpeg', 0.6);
              setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), base64] }));
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    };

    const removePhoto = (index) => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));

    const handleSurfaceToggle = (tipe) => {
      setFormData(prev => {
        const isSelected = prev.surfaceTypes.includes(tipe);
        const newSurfaceTypes = isSelected ? prev.surfaceTypes.filter(t => t !== tipe) : [...prev.surfaceTypes, tipe];
        return { ...prev, surfaceTypes: newSurfaceTypes };
      });
    };

    const getGPS = () => {
      if (!navigator.geolocation) return showToast("GPS tidak didukung oleh browser ini", "error");
      showToast("Mengambil lokasi...", "info");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }));
          showToast(`Lokasi didapat! Akurasi: ${Math.round(pos.coords.accuracy)}m`, "success");
        },
        (err) => showToast(`Gagal GPS: ${err.message}`, "error"),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const downloadGeoJSON = () => {
      if (path.length === 0) return;
      const geojson = {
        type: "FeatureCollection",
        features: [{
          type: "Feature", properties: { name: formData.roadName, distance: calculateTotalDistance(path), year: new Date().getFullYear() },
          geometry: { type: "LineString", coordinates: path.map(p => [p[1], p[0]]) }
        }]
      };
      const blob = new Blob([JSON.stringify(geojson)], {type: "application/json"});
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `track-${formData.roadName || 'jalan'}.geojson`; a.click();
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.roadName) return showToast("Nama jalan wajib diisi", "error");
      if (!formData.lat && !formData.lng && path.length < 2) return showToast("Mohon isi Titik Lokasi atau Rekam Track GPS", "error");

      const basePayload = {
        roadName: formData.roadName, condition: formData.condition, year: new Date().getFullYear(),
        surfaceTypes: formData.surfaceTypes || [], description: formData.description,
        photos: formData.photos || [], surveyDate: new Date().toISOString()
      };

      if (path.length >= 2) {
        basePayload.trackPath = path; basePayload.distanceMeters = Math.round(calculateTotalDistance(path));
      }
      if (formData.lat && formData.lng) {
        basePayload.location = { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) };
      }

      setIsSaving(true);
      try {
        if (!supabase) {
          setRoadsData(prevData => [{ ...basePayload, id: Date.now(), created_at: new Date().toISOString() }, ...prevData]);
          showToast("Disimpan sementara (Mode Preview Lokal)", "success");
        } else {
          const { error } = await supabase.from('roads').insert([basePayload]);
          if (error) throw error;
          showToast("Data berhasil disimpan ke Supabase!", "success");
        }
        setFormData({ roadName: '', condition: 'Baik', description: '', photos: [], surfaceTypes: [], lat: '', lng: '', accuracy: 0 });
        setPath([]);
        setActiveTab('map');
      } catch (err) { showToast(`Error: ${err.message}`, "error"); } 
      finally { setIsSaving(false); }
    };

    return (
      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6 max-w-2xl mx-auto pb-36">
        <h2 className="text-2xl font-bold border-b border-slate-200 pb-3 text-slate-800">Input Data Jalan</h2>

        {/* 1. Titik Lokasi */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">1. Titik Lokasi Pusat</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={getGPS} className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-blue-100 border border-blue-200 active:scale-[0.98] transition-transform font-bold text-sm">
              <Navigation size={18} /> Deteksi Otomatis
            </button>
            <button type="button" onClick={() => setShowPointPicker(true)} className="flex-1 bg-white text-slate-700 py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-slate-50 border border-slate-200 active:scale-[0.98] transition-transform font-bold text-sm shadow-sm">
              <MapIcon size={18} /> Pilih di Peta
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="any" placeholder="Latitude" className="w-full p-3 border border-slate-300 rounded-xl text-[15px] bg-slate-50 shadow-inner focus:outline-none" value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} />
            <input type="number" step="any" placeholder="Longitude" className="w-full p-3 border border-slate-300 rounded-xl text-[15px] bg-slate-50 shadow-inner focus:outline-none" value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} />
          </div>
        </div>

        {/* 2. Nama Jalan */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">2. Nama Jalan</label>
          <input required type="text" placeholder="Cth: Jl. Ahmad Yani" className="w-full p-3 border border-slate-300 rounded-xl text-[15px] shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.roadName} onChange={e => setFormData({...formData, roadName: e.target.value})} />
        </div>

        {/* 3. Kondisi Jalan */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">3. Kondisi Jalan</label>
          <select className="w-full p-3 border border-slate-300 rounded-xl text-[15px] shadow-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})}>
            <option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
          </select>
        </div>

        {/* 4. Jenis Permukaan */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">4. Jenis Permukaan</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['Aspal', 'Beton', 'Tanah', 'Paving Block', 'Berbatuan', 'Lainnya'].map(tipe => (
              <label key={tipe} className={`flex items-center gap-2 text-sm border p-3 rounded-xl cursor-pointer transition-colors shadow-sm ${formData.surfaceTypes.includes(tipe) ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 font-medium'}`}>
                <input type="checkbox" checked={formData.surfaceTypes.includes(tipe)} onChange={() => handleSurfaceToggle(tipe)} className="rounded text-blue-600 w-4 h-4 cursor-pointer accent-blue-600" />
                {tipe}
              </label>
            ))}
          </div>
        </div>

        {/* 5. Keterangan */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">5. Keterangan</label>
          <textarea rows="3" placeholder="Tambahkan keterangan..." className="w-full p-3 border border-slate-300 rounded-xl text-[15px] shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
        </div>

        {/* 6. Foto */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">6. Foto Dokumentasi</label>
          <div className="flex flex-wrap gap-3">
            {(formData.photos || []).map((photo, i) => (
              <div key={i} className="relative w-20 h-20 border rounded-xl overflow-hidden shadow-sm">
                <img src={photo} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md active:scale-95"><X size={12} /></button>
              </div>
            ))}
            <label className="w-20 h-20 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl flex flex-col items-center justify-center text-blue-500 cursor-pointer hover:bg-blue-100 transition-colors active:scale-95">
              <Camera size={24} />
              <span className="text-[10px] mt-1 font-bold text-center leading-tight">Tambah<br/>Foto</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
        </div>

        {/* 7. Jalur Rute (Modern Track Editor) */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">7. Data Jalur / Track Panjang</label>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm relative overflow-hidden">
            
            {path.length === 0 ? (
              <div className="text-center py-4">
                <Activity size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 font-medium mb-4">Belum ada jalur yang dibuat.</p>
                <button type="button" onClick={() => setShowTrackCreator(true)}
                  className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <MapIcon size={18}/> Buka Editor Jalur (Manual & GPS)
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="text-2xl font-extrabold text-slate-800">
                      {(calculateTotalDistance(path) / 1000).toFixed(2)} <span className="text-sm text-slate-500 font-medium">KM</span>
                    </div>
                    <p className="text-[11px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-md inline-block mt-1">✓ {path.length} Titik Jalur Tersimpan</p>
                  </div>
                  <button type="button" onClick={() => setShowTrackCreator(true)} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold active:scale-95 shadow-sm">
                    Edit Jalur
                  </button>
                </div>
                {leafletLoaded && (
                  <div className="h-32 w-full rounded-xl overflow-hidden border border-slate-300 shadow-inner">
                    <MiniMap path={path} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-200">
          <button disabled={isSaving} type="submit" 
            className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/30">
            <Save size={22} /> {isSaving ? 'Menyimpan...' : 'Simpan Data Peta'}
          </button>
          {path.length >= 2 && (
            <button type="button" onClick={downloadGeoJSON} className="bg-slate-200 text-slate-700 px-5 rounded-xl font-bold flex justify-center items-center active:scale-[0.98] transition-transform" title="Download GeoJSON">
              <Download size={22} />
            </button>
          )}
        </div>

        {showPointPicker && <MapPicker initialLat={formData.lat} initialLng={formData.lng} onSelect={(lat, lng) => {setFormData({...formData, lat, lng, accuracy: 0}); setShowPointPicker(false);}} onClose={() => setShowPointPicker(false)} />}
        {showTrackCreator && <TrackCreator initialPath={path} onSave={(newPath) => {setPath(newPath); setShowTrackCreator(false);}} onClose={() => setShowTrackCreator(false)} />}
      </form>
    );
  };

  const MapView = () => {
    const [filterCondition, setFilterCondition] = useState('Semua');
    const [filterYear, setFilterYear] = useState('Semua');
    const mapRef = useRef(null); const mapInstance = useRef(null);
    const markersGroup = useRef(null);
    const center = [-0.485, 117.155];

    const uniqueYears = Array.from(new Set(roadsData.map(r => r.year).filter(Boolean))).sort((a, b) => b - a);
    const filteredRoads = roadsData.filter(road => (filterCondition === 'Semua' ? true : road.condition === filterCondition) && (filterYear === 'Semua' ? true : String(road.year) === String(filterYear)));

    const countBaik = filteredRoads.filter(r => r.condition === 'Baik').length;
    const countSedang = filteredRoads.filter(r => r.condition === 'Sedang').length;
    const countRusakRingan = filteredRoads.filter(r => r.condition === 'Rusak Ringan').length;
    const countRusakBerat = filteredRoads.filter(r => r.condition === 'Rusak Berat').length;

    useEffect(() => {
      if (!window.L || !mapRef.current) return;
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView(center, 14);
        const osm = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });
        const esri = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri' });
        osm.addTo(mapInstance.current);
        window.L.control.zoom({ position: 'topleft' }).addTo(mapInstance.current);
        window.L.control.layers({ "Street Map (OSM)": osm, "Citra Satelit (Esri)": esri }).addTo(mapInstance.current);
        setTimeout(() => { if (mapInstance.current) mapInstance.current.invalidateSize(); }, 250);
        markersGroup.current = window.L.layerGroup().addTo(mapInstance.current);
      }

      if (markersGroup.current) markersGroup.current.clearLayers();

      const createCustomIcon = (color) => window.L.divIcon({ className: 'custom-leaflet-icon', html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
      const icons = { 'Baik': createCustomIcon('#22c55e'), 'Sedang': createCustomIcon('#eab308'), 'Rusak Ringan': createCustomIcon('#f97316'), 'Rusak Berat': createCustomIcon('#ef4444'), 'default': createCustomIcon('#3b82f6') };
      const getPolylineColor = (condition) => { switch(condition) { case 'Baik': return '#22c55e'; case 'Sedang': return '#eab308'; case 'Rusak Ringan': return '#f97316'; case 'Rusak Berat': return '#ef4444'; default: return '#3b82f6'; } };

      filteredRoads.forEach(road => {
        const photoHTML = road.photos && road.photos.length > 0 ? `<div style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 0.75rem; padding-bottom: 4px;">${road.photos.map(p => `<img src="${p}" style="height: 80px; min-width: 80px; border-radius: 8px; object-fit: cover; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" />`).join('')}</div>` : '';
        const popupContent = `
            <div style="min-width: 220px; font-family: sans-serif;">
              <h3 style="font-weight: 800; font-size: 1.25rem; margin-bottom: 0.75rem; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">${road.roadName}</h3>
              ${photoHTML}
              <div style="font-size: 0.85rem; margin-bottom: 0.75rem; background-color: #f8fafc; padding: 0.75rem; border-radius: 0.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border: 1px solid #e2e8f0;">
                <div style="grid-column: span 2;"><span style="color: #64748b; display: block; font-size: 0.75rem;">Permukaan:</span> <b style="color: #334155;">${road.surfaceTypes && road.surfaceTypes.length > 0 ? road.surfaceTypes.join(', ') : '-'}</b></div>
                <div><span style="color: #64748b; display: block; font-size: 0.75rem;">Kondisi:</span> <b style="color: #334155;">${road.condition}</b></div>
                <div><span style="color: #64748b; display: block; font-size: 0.75rem;">Tahun:</span> <b style="color: #334155;">${road.year || '-'}</b></div>
                ${road.trackPath && road.trackPath.length > 0 ? `<div style="grid-column: span 2;"><span style="color: #64748b; display: block; font-size: 0.75rem;">Panjang Jalur:</span> <b style="color: #334155;">${(road.distanceMeters / 1000).toFixed(2)} km</b></div>` : ''}
              </div>
              ${road.description ? `<p style="font-size: 0.85rem; font-style: italic; background-color: #fefce8; padding: 0.5rem; border-left: 3px solid #facc15; margin-bottom: 0.75rem; border-radius: 0 0.25rem 0.25rem 0; color: #854d0e;">"${road.description}"</p>` : ''}
            </div>
          `;

        if (road.trackPath && road.trackPath.length > 0) {
          const polyline = window.L.polyline(road.trackPath, { color: getPolylineColor(road.condition), weight: 6, opacity: 0.85 });
          polyline.bindPopup(popupContent, { maxWidth: 300 });
          markersGroup.current.addLayer(polyline);
        }
        if (road.location && road.location.lat && road.location.lng) {
          const marker = window.L.marker([road.location.lat, road.location.lng], { icon: icons[road.condition] || icons.default });
          marker.bindPopup(popupContent, { maxWidth: 300 });
          markersGroup.current.addLayer(marker);
        }
      });
    }, [filteredRoads, leafletLoaded]);

    if (!leafletLoaded) return <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 font-medium">Memuat Komponen Peta GIS...</div>;

    return (
      <div className="absolute inset-0 w-full h-full">
        {/* Floating Filter Panel */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 flex flex-col gap-3 min-w-[140px] border border-slate-100">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Kondisi</span>
            <select className="text-sm p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 font-medium text-slate-700" value={filterCondition} onChange={e => setFilterCondition(e.target.value)}>
              <option>Semua</option><option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Tahun</span>
            <select className="text-sm p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 font-medium text-slate-700" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option>Semua</option>{uniqueYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 left-3 z-[1000] bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg text-xs border border-slate-100 font-medium text-slate-700 min-w-[160px]">
          <div className="font-extrabold mb-3 text-slate-800 border-b pb-1.5 flex justify-between">
            <span>Legenda</span><span className="bg-slate-200 text-[10px] px-1.5 py-0.5 rounded-full">{filteredRoads.length} Data</span>
          </div>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#22c55e] border border-white"></div> Baik</div><span className="font-bold bg-slate-100 px-1.5 rounded">{countBaik}</span></div>
          <div className="flex items-center justify-between gap-3 mt-2"><div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#eab308] border border-white"></div> Sedang</div><span className="font-bold bg-slate-100 px-1.5 rounded">{countSedang}</span></div>
          <div className="flex items-center justify-between gap-3 mt-2"><div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#f97316] border border-white"></div> R. Ringan</div><span className="font-bold bg-slate-100 px-1.5 rounded">{countRusakRingan}</span></div>
          <div className="flex items-center justify-between gap-3 mt-2"><div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#ef4444] border border-white"></div> R. Berat</div><span className="font-bold bg-slate-100 px-1.5 rounded">{countRusakBerat}</span></div>
        </div>
        <div ref={mapRef} className="w-full h-full z-0"></div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      <header className="bg-slate-900 text-white px-4 py-4 pt-[max(env(safe-area-inset-top),1rem)] flex justify-between items-center shadow-md z-20 relative">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg shadow-inner"><MapPin size={20} className="text-white" /></div>
          <div><h1 className="font-extrabold text-lg leading-tight">GIS Kelurahan</h1><span className="block text-[11px] text-blue-200">Peta Sebaran Jalan</span></div>
        </div>
      </header>

      <main className="flex-1 relative z-0 overflow-y-auto w-full">
        {activeTab === 'map' && <MapView />}
        {activeTab === 'input' && <UnifiedForm />}
        
        {toast.show && (
          <div className={`fixed top-[max(env(safe-area-inset-top),5rem)] left-1/2 transform -translate-x-1/2 z-[9999] px-5 py-3 rounded-full shadow-2xl text-sm font-bold flex items-center gap-3 text-white animate-fade-in-down w-[90%] max-w-sm justify-between ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
            <span className="truncate">{toast.message}</span> 
            <button onClick={() => setToast({...toast, show: false})} className="bg-black/20 p-1 rounded-full"><X size={16}/></button>
          </div>
        )}
      </main>

      <nav className="bg-white border-t border-slate-200 flex justify-around px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-20 relative">
        <button onClick={() => setActiveTab('map')} className={`flex-1 flex flex-col items-center py-2.5 px-1 rounded-2xl transition-all ${activeTab === 'map' ? 'text-blue-700 bg-blue-50 scale-105 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
          <MapIcon size={24} className={activeTab === 'map' ? 'stroke-[2.5px]' : 'stroke-2'} />
          <span className="text-[11px] mt-1.5">Lihat Peta</span>
        </button>
        <button onClick={() => setActiveTab('input')} className={`flex-1 flex flex-col items-center py-2.5 px-1 rounded-2xl transition-all ${activeTab === 'input' ? 'text-blue-700 bg-blue-50 scale-105 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
          <PlusSquare size={24} className={activeTab === 'input' ? 'stroke-[2.5px]' : 'stroke-2'} />
          <span className="text-[11px] mt-1.5">Input Data</span>
        </button>
      </nav>
    </div>
  );
}
