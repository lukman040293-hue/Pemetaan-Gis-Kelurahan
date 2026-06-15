import React, { useState, useEffect, useRef } from 'react';
import { 
  Map as MapIcon, PlusSquare, Navigation, Save, 
  Wifi, WifiOff, Camera, MapPin, Activity, X, Download, Database
} from 'lucide-react';

// --- SUPABASE INITIALIZATION ---
// PENTING: Saat Anda menyalin kode ini ke project Vite Anda di komputer, 
// silakan HAPUS tanda komentar (//) pada 4 baris kode di bawah ini:

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Untuk keperluan preview di halaman ini agar tidak terjadi error kompilasi, 
// kita tetapkan supabase sebagai null (KODE INI HARUS DIKOMENTARI ATAU DIHAPUS DI STACKBLITZ):
// const supabase = null;

// --- HELPER FUNCTIONS ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// --- DATA BATAS WILAYAH (GEOJSON) ---
const batasKelurahanGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "nama": "Pelita",
        "sumber": "Siadwil & Monografi Kelurahan",
        "penduduk": "14.077 Jiwa",
        "luas": "892 Km²"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [117.1512, -0.4770], [117.1538, -0.4772], [117.1565, -0.4778], [117.1590, -0.4795],
            [117.1615, -0.4820], [117.1625, -0.4845], [117.1630, -0.4865], [117.1625, -0.4895],
            [117.1610, -0.4908], [117.1590, -0.4915], [117.1570, -0.4925], [117.1555, -0.4938],
            [117.1540, -0.4945], [117.1525, -0.4950], [117.1510, -0.4953], [117.1495, -0.4948],
            [117.1482, -0.4930], [117.1475, -0.4915], [117.1470, -0.4900], [117.1478, -0.4875],
            [117.1488, -0.4845], [117.1498, -0.4815], [117.1508, -0.4785], [117.1512, -0.4770]
          ]
        ]
      }
    }
  ]
};

// --- MAIN APPLICATION COMPONENT ---
export default function App() {
  // Jika Supabase belum dikonfigurasi (seperti di layar preview ini)
  if (!supabase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <Database size={64} className="text-emerald-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Siap Terhubung ke Supabase!</h1>
        <p className="text-slate-600 mb-6 max-w-md">
          Aplikasi ini telah diperbarui untuk menggunakan Supabase. Namun, kredensial Anda belum ditemukan.
        </p>
        <div className="bg-slate-800 text-left p-4 rounded-lg text-emerald-400 font-mono text-sm overflow-x-auto w-full max-w-lg shadow-lg">
          <p className="text-slate-400 mb-2"># Buat file <span className="text-white">.env</span> di project lokal Anda dan isi dengan:</p>
          <p>VITE_SUPABASE_URL=https://xyzcompany.supabase.co</p>
          <p>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...</p>
        </div>
      </div>
    );
  }

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState('map'); 
  const [roadsData, setRoadsData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true); document.head.appendChild(script);
    
    const handleOnline = () => setIsOnline(true); const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  // Fetch data dari Supabase secara Realtime
  useEffect(() => {
    const fetchRoads = async () => {
      const { data, error } = await supabase.from('roads').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setRoadsData(data || []);
      }
    };

    fetchRoads();

    // Subscribe untuk update realtime dari Supabase
    const subscription = supabase
      .channel('public:roads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roads' }, (payload) => {
        fetchRoads(); // Ambil data ulang jika ada perubahan
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };

  // --- KOMPONEN MAP PICKER ---
  const MapPicker = ({ initialLat, initialLng, onSelect, onClose }) => {
    const mapRef = useRef(null); const mapInstance = useRef(null); const markerRef = useRef(null);

    useEffect(() => {
      if (!window.L || !mapRef.current) return;
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView([-0.485, 117.155], 14);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
        window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        const boundaryLayer = window.L.geoJSON(batasKelurahanGeoJSON, { style: { color: "#0ea5e9", weight: 2, fillOpacity: 0.05 }, interactive: false }).addTo(mapInstance.current);
        const boundsCenter = boundaryLayer.getBounds().getCenter();
        const markerPos = (initialLat && initialLng) ? [initialLat, initialLng] : boundsCenter;
        markerRef.current = window.L.marker(markerPos, { draggable: true }).addTo(mapInstance.current);

        setTimeout(() => {
          if (mapInstance.current) {
            mapInstance.current.invalidateSize();
            if (!initialLat || !initialLng) mapInstance.current.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20] });
            else mapInstance.current.setView(markerPos, 17);
          }
        }, 250);

        mapInstance.current.on('click', (e) => {
          if (markerRef.current) markerRef.current.setLatLng(e.latlng);
          onSelect(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
          onClose();
        });
      }
      return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
    }, [initialLat, initialLng]);

    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shadow-md">
          <h3 className="font-bold">Pilih Titik Lokasi</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-700 rounded"><X size={24}/></button>
        </div>
        <div className="bg-blue-50 p-2 text-xs text-blue-800 text-center border-b border-blue-100">
          Klik area peta untuk menentukan letak koordinat (Otomatis kembali ke form).
        </div>
        <div className="flex-1 relative"><div ref={mapRef} style={{ height: '100%', width: '100%' }}></div></div>
        <div className="p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button type="button" onClick={() => { if(markerRef.current){ const pos = markerRef.current.getLatLng(); onSelect(pos.lat.toFixed(6), pos.lng.toFixed(6)); } onClose(); }} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2">
            <MapPin size={18} /> Gunakan Koordinat Ini
          </button>
        </div>
      </div>
    );
  };

  // --- KOMPONEN MINI MAP UNTUK TRACKING ---
  const MiniMap = ({ path }) => {
    const mapRef = useRef(null); const mapInstance = useRef(null); const polylineRef = useRef(null);
    useEffect(() => {
      if (!window.L || !mapRef.current) return;
      const lastPoint = path[path.length - 1];
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView(lastPoint, 16);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
      } else mapInstance.current.setView(lastPoint, 16);

      if (polylineRef.current) mapInstance.current.removeLayer(polylineRef.current);
      polylineRef.current = window.L.polyline(path, { color: 'blue', weight: 5 }).addTo(mapInstance.current);
    }, [path]);
    return <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />;
  };

  // --- TAB: UNIFIED INPUT FORM (TITIK & TRACK) ---
  const UnifiedForm = () => {
    const [mappingType, setMappingType] = useState('point');
    const [showPicker, setShowPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
      roadName: '', condition: 'Baik', year: new Date().getFullYear().toString(),
      description: '', videoUrl: '', photos: [], surfaceTypes: [],
      lat: '', lng: '', accuracy: 0
    });

    const [isTracking, setIsTracking] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [path, setPath] = useState([]);
    const [distance, setDistance] = useState(0); 
    const watchIdRef = useRef(null);

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
      if (!navigator.geolocation) return showToast("GPS tidak didukung", "error");
      showToast("Mengambil lokasi...", "info");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }));
          showToast(`Lokasi didapat! Akurasi: ${Math.round(pos.coords.accuracy)}m`, "success");
        },
        (err) => {
          if (err.message.includes("permissions policy") || err.code === 1) {
            showToast("Akses GPS diblokir di preview ini. Gunakan 'Pilih di Peta'.", "error");
          } else {
            showToast(`Gagal GPS: ${err.message}`, "error");
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const toggleSimulation = () => {
      if (isTracking || isSimulating) {
        clearInterval(watchIdRef.current);
        setIsTracking(false); setIsSimulating(false); showToast("Perekaman dihentikan", "info");
      } else {
        setPath([]); setDistance(0); setIsTracking(true); setIsSimulating(true);
        showToast("Mulai simulasi merekam jalur...", "success");
        let currentLat = -0.485; let currentLng = 117.155;
        
        watchIdRef.current = setInterval(() => {
          currentLat += (Math.random() - 0.2) * 0.0004;
          currentLng += (Math.random() - 0.2) * 0.0004;
          setPath(prevPath => {
            const newPoint = [currentLat, currentLng];
            if (prevPath.length > 0) {
              const lastPoint = prevPath[prevPath.length - 1];
              const dist = calculateDistance(lastPoint[0], lastPoint[1], currentLat, currentLng);
              setDistance(d => d + dist);
            }
            return [...prevPath, newPoint];
          });
        }, 1500);
      }
    };

    const toggleTracking = () => {
      if (isTracking) {
        if (isSimulating) { toggleSimulation(); return; }
        navigator.geolocation.clearWatch(watchIdRef.current);
        setIsTracking(false); showToast("Perekaman dihentikan", "info");
      } else {
        if (!navigator.geolocation) return showToast("GPS tidak didukung", "error");
        setPath([]); setDistance(0); setIsTracking(true); setIsSimulating(false);
        showToast("Mulai merekam jalur...", "success");

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            if (accuracy > 30) return; 
            setPath(prevPath => {
              const newPoint = [latitude, longitude];
              if (prevPath.length > 0) {
                const lastPoint = prevPath[prevPath.length - 1];
                const dist = calculateDistance(lastPoint[0], lastPoint[1], latitude, longitude);
                if (dist > 2) { setDistance(d => d + dist); return [...prevPath, newPoint]; }
                return prevPath;
              }
              return [newPoint];
            });
          },
          (err) => {
             setIsTracking(false);
             if (err.message.includes("permissions policy") || err.code === 1) {
                showToast("Akses GPS asli diblokir browser. Gunakan tombol 'Simulasi Track' di sebelahnya.", "error");
             } else {
                showToast(`Error GPS: ${err.message}`, "error");
             }
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }
    };

    const downloadGeoJSON = () => {
      if (path.length === 0) return;
      const geojson = {
        type: "FeatureCollection",
        features: [{
          type: "Feature", properties: { name: formData.roadName, distance: distance, year: formData.year },
          geometry: { type: "LineString", coordinates: path.map(p => [p[1], p[0]]) }
        }]
      };
      const blob = new Blob([JSON.stringify(geojson)], {type: "application/json"});
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `track-${formData.roadName || 'jalan'}.geojson`; a.click();
    };

    // --- Insert ke Supabase ---
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.roadName) return showToast("Nama jalan wajib diisi", "error");

      const basePayload = {
        roadName: formData.roadName,
        condition: formData.condition,
        year: parseInt(formData.year) || new Date().getFullYear(),
        surfaceTypes: formData.surfaceTypes || [],
        description: formData.description,
        videoUrl: formData.videoUrl || '',
        photos: formData.photos || [],
        surveyDate: new Date().toISOString()
      };

      if (mappingType === 'point') {
        if (!formData.lat || !formData.lng) return showToast("Koordinat GPS wajib diisi!", "error");
        basePayload.type = 'point';
        basePayload.location = { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) };
      } else {
        if (path.length < 2) return showToast("Jalur terlalu pendek untuk disimpan", "error");
        basePayload.type = 'track';
        basePayload.trackPath = path;
        basePayload.distanceMeters = Math.round(distance);
      }

      setIsSaving(true);
      try {
        const { error } = await supabase.from('roads').insert([basePayload]);
        
        if (error) throw error;

        showToast("Data berhasil disimpan ke Supabase!", "success");
        setFormData({ roadName: '', condition: 'Baik', year: new Date().getFullYear().toString(), description: '', videoUrl: '', photos: [], surfaceTypes: [], lat: '', lng: '', accuracy: 0 });
        if (mappingType === 'track') { setPath([]); setDistance(0); }
        setActiveTab('map');
      } catch (err) {
        showToast(`Error: ${err.message}`, "error");
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
        <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
          <button type="button" onClick={() => setMappingType('point')} disabled={isTracking}
            className={`flex flex-1 justify-center items-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${mappingType === 'point' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
            <MapPin size={16} /> Titik (Point)
          </button>
          <button type="button" onClick={() => setMappingType('track')} disabled={isTracking}
            className={`flex flex-1 justify-center items-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${mappingType === 'track' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
            <Activity size={16} /> Jalur (Track)
          </button>
        </div>

        <h2 className="text-xl font-bold border-b pb-2">
          Input Data {mappingType === 'point' ? 'Titik Lokasi' : 'Jalur Jalan'}
        </h2>

        {mappingType === 'point' ? (
          <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
            <label className="block text-sm font-medium mb-1">Koordinat GPS *</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={getGPS} className="flex-1 bg-blue-100 text-blue-700 py-2 rounded flex justify-center items-center gap-2 hover:bg-blue-200 text-sm font-medium">
                <Navigation size={16} /> GPS Otomatis
              </button>
              <button type="button" onClick={() => setShowPicker(true)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded flex justify-center items-center gap-2 hover:bg-slate-200 border border-slate-200 text-sm font-medium">
                <MapIcon size={16} /> Pilih di Peta
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input required type="number" step="any" placeholder="Latitude" className="w-full p-2 border rounded text-sm bg-white"
                value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} />
              <input required type="number" step="any" placeholder="Longitude" className="w-full p-2 border rounded text-sm bg-white"
                value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} />
            </div>
            {formData.accuracy > 0 && <p className="text-xs text-green-600 mt-1">Akurasi: ±{formData.accuracy} meter</p>}
          </div>
        ) : (
          <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg text-center">
            <div className="text-3xl font-mono mb-1">
              {(distance / 1000).toFixed(2)} <span className="text-base text-slate-300">KM</span>
            </div>
            <p className="text-xs text-slate-400">Jarak Perekaman GPS</p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={toggleTracking} disabled={isSimulating}
                className={`flex-1 py-3 rounded font-bold text-sm transition-all disabled:opacity-50 ${isTracking && !isSimulating ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-green-500 hover:bg-green-600'}`}>
                {isTracking && !isSimulating ? '⏹ Stop' : '⏺ Mulai Asli'}
              </button>
              <button type="button" onClick={toggleSimulation} disabled={isTracking && !isSimulating}
                className={`flex-1 py-3 rounded font-bold text-sm transition-all disabled:opacity-50 ${isSimulating ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'}`}>
                {isSimulating ? '⏹ Stop Simulasi' : '🎮 Simulasi Track'}
              </button>
            </div>
            {path.length > 0 && leafletLoaded && (
              <div className="h-32 w-full rounded-lg overflow-hidden border border-slate-600 mt-4">
                <MiniMap path={path} />
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Jalan / Ruas *</label>
            <input required type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={formData.roadName} onChange={e => setFormData({...formData, roadName: e.target.value})} disabled={isTracking} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Jenis Permukaan (Bisa pilih {'>'} 1)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['Aspal', 'Beton', 'Paving Block', 'Berbatuan', 'Tanah', 'Berlobang'].map(tipe => (
                <label key={tipe} className="flex items-center gap-2 text-xs border p-2 rounded cursor-pointer hover:bg-slate-50 text-slate-700">
                  <input type="checkbox" checked={formData.surfaceTypes.includes(tipe)} onChange={() => handleSurfaceToggle(tipe)} disabled={isTracking} className="rounded text-blue-600 w-4 h-4 cursor-pointer" />
                  {tipe}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Kondisi *</label>
              <select className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} disabled={isTracking}>
                <option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tahun *</label>
              <input required type="number" min="2000" max="2100" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} disabled={isTracking} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Keterangan Tambahan</label>
            <textarea rows="2" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} disabled={isTracking}></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link Video (Google Drive/YouTube)</label>
            <input type="url" placeholder="https://..." className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm"
              value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} disabled={isTracking} />
          </div>

          {!isTracking && (
            <div>
              <label className="block text-sm font-medium mb-1">Foto Kondisi Jalan</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.photos || []).map((photo, i) => (
                  <div key={i} className="relative w-16 h-16 border rounded overflow-hidden shadow-sm">
                    <img src={photo} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-red-500/80 hover:bg-red-600 text-white p-1 text-[10px] rounded-bl"><X size={10} /></button>
                  </div>
                ))}
                <label className="w-16 h-16 border-2 border-dashed border-blue-300 rounded flex flex-col items-center justify-center text-blue-500 cursor-pointer hover:bg-blue-50 transition-colors">
                  <Camera size={18} />
                  <span className="text-[8px] mt-1 font-medium text-center leading-tight">Ambil<br/>Foto</span>
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button disabled={isSaving || isTracking || (mappingType === 'track' && path.length < 2)} type="submit" 
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
            <Save size={20} /> {isSaving ? 'Menyimpan...' : 'Simpan Data'}
          </button>
          {mappingType === 'track' && (
            <button type="button" onClick={downloadGeoJSON} disabled={path.length < 2 || isTracking} className="bg-gray-200 text-gray-700 p-3 rounded-lg font-bold disabled:opacity-50 flex justify-center items-center">
              <Download size={20} />
            </button>
          )}
        </div>

        {showPicker && mappingType === 'point' && (
          <MapPicker initialLat={formData.lat} initialLng={formData.lng} onSelect={(lat, lng) => setFormData({...formData, lat, lng, accuracy: 0})} onClose={() => setShowPicker(false)} />
        )}
      </form>
    );
  };

  // --- TAB: MAIN MAP ---
  const MapView = () => {
    const [filterCondition, setFilterCondition] = useState('Semua');
    const [filterYear, setFilterYear] = useState('Semua');
    const mapRef = useRef(null); const mapInstance = useRef(null);
    const markersGroup = useRef(null); const boundaryLayer = useRef(null);
    const center = [-0.485, 117.155];

    const uniqueYears = Array.from(new Set(roadsData.map(r => r.year).filter(Boolean))).sort((a, b) => b - a);

    useEffect(() => {
      if (!window.L || !mapRef.current) return;

      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView(center, 14);
        const osm = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' });
        const esri = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri' });
        osm.addTo(mapInstance.current);

        boundaryLayer.current = window.L.geoJSON(batasKelurahanGeoJSON, {
          style: function () { return { color: "#0ea5e9", weight: 3, opacity: 1, fillOpacity: 0.05, fillColor: "#0ea5e9" }; },
          interactive: false
        });

        boundaryLayer.current.addTo(mapInstance.current);
        window.L.control.layers({ "Street Map (OSM)": osm, "Citra Satelit (Esri)": esri }, { "Batas Wilayah": boundaryLayer.current }).addTo(mapInstance.current);

        setTimeout(() => {
          if (mapInstance.current && boundaryLayer.current) {
            mapInstance.current.invalidateSize(); mapInstance.current.fitBounds(boundaryLayer.current.getBounds(), { padding: [20, 20] });
          }
        }, 250);

        markersGroup.current = window.L.layerGroup().addTo(mapInstance.current);
      }

      if (markersGroup.current) markersGroup.current.clearLayers();

      const filteredRoads = roadsData.filter(road => {
        const matchCondition = filterCondition === 'Semua' ? true : road.condition === filterCondition;
        const matchYear = filterYear === 'Semua' ? true : String(road.year) === String(filterYear);
        return matchCondition && matchYear;
      });

      const createCustomIcon = (color) => window.L.divIcon({ className: 'custom-leaflet-icon', html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
      const icons = { 'Baik': createCustomIcon('#22c55e'), 'Sedang': createCustomIcon('#eab308'), 'Rusak Ringan': createCustomIcon('#f97316'), 'Rusak Berat': createCustomIcon('#ef4444'), 'default': createCustomIcon('#3b82f6') };
      const getPolylineColor = (condition) => { switch(condition) { case 'Baik': return '#22c55e'; case 'Sedang': return '#eab308'; case 'Rusak Ringan': return '#f97316'; case 'Rusak Berat': return '#ef4444'; default: return '#3b82f6'; } };

      filteredRoads.forEach(road => {
        const photoHTML = road.photos && road.photos.length > 0 ? `<div style="display: flex; gap: 4px; overflow-x: auto; margin-bottom: 0.5rem; padding-bottom: 4px;">${road.photos.map(p => `<img src="${p}" style="height: 60px; min-width: 60px; border-radius: 4px; object-fit: cover; border: 1px solid #e5e7eb;" />`).join('')}</div>` : '';
        const videoHTML = road.videoUrl ? `<a href="${road.videoUrl}" target="_blank" style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #fff; background-color: #ef4444; padding: 4px 8px; border-radius: 4px; text-decoration: none; margin-bottom: 0.5rem; width: fit-content;">▶️ Tonton Video</a>` : '';

        if (road.type === 'point' && road.location) {
          const marker = window.L.marker([road.location.lat, road.location.lng], { icon: icons[road.condition] || icons.default });
          marker.bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="font-weight: bold; font-size: 1.125rem; margin-bottom: 0.5rem;">${road.roadName}</h3>
              ${photoHTML}${videoHTML}
              <div style="font-size: 0.75rem; margin-bottom: 0.5rem; background-color: #f9fafb; padding: 0.5rem; border-radius: 0.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <div style="grid-column: span 2;"><span style="color: #9ca3af; display: block;">Permukaan:</span> <b>${road.surfaceTypes && road.surfaceTypes.length > 0 ? road.surfaceTypes.join(', ') : '-'}</b></div>
                <div><span style="color: #9ca3af; display: block;">Kondisi:</span> <b>${road.condition}</b></div>
                <div><span style="color: #9ca3af; display: block;">Tahun:</span> <b>${road.year || '-'}</b></div>
              </div>
              ${road.description ? `<p style="font-size: 0.75rem; font-style: italic; background-color: #fefce8; padding: 0.25rem; border-left: 2px solid #facc15; margin-bottom: 0.5rem;">${road.description}</p>` : ''}
              <p style="font-size: 0.625rem; color: #9ca3af;">Tgl: ${new Date(road.surveyDate).toLocaleDateString('id-ID')}</p>
            </div>
          `);
          markersGroup.current.addLayer(marker);
        } else if (road.type === 'track' && road.trackPath) {
          const polyline = window.L.polyline(road.trackPath, { color: getPolylineColor(road.condition), weight: 5, opacity: 0.8 });
          polyline.bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="font-weight: bold; margin-bottom: 0.5rem;">${road.roadName}</h3>
              ${photoHTML}${videoHTML}
              <div style="font-size: 0.75rem; margin-bottom: 0.5rem; background-color: #f9fafb; padding: 0.5rem; border-radius: 0.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <div style="grid-column: span 2;"><span style="color: #9ca3af; display: block;">Permukaan:</span> <b>${road.surfaceTypes && road.surfaceTypes.length > 0 ? road.surfaceTypes.join(', ') : '-'}</b></div>
                <div><span style="color: #9ca3af; display: block;">Kondisi:</span> <b>${road.condition}</b></div>
                <div><span style="color: #9ca3af; display: block;">Tahun:</span> <b>${road.year || '-'}</b></div>
                <div style="grid-column: span 2;"><span style="color: #9ca3af; display: block;">Panjang:</span> <b>${(road.distanceMeters / 1000).toFixed(2)} km</b></div>
              </div>
              ${road.description ? `<p style="font-size: 0.75rem; font-style: italic; background-color: #fefce8; padding: 0.25rem; border-left: 2px solid #facc15; margin-bottom: 0.5rem;">${road.description}</p>` : ''}
              <p style="font-size: 0.625rem; color: #9ca3af;">Tgl: ${new Date(road.surveyDate).toLocaleDateString('id-ID')}</p>
            </div>
          `);
          markersGroup.current.addLayer(polyline);
        }
      });
    }, [roadsData, filterCondition, filterYear, leafletLoaded]);

    if (!leafletLoaded) return <div className="h-full w-full flex items-center justify-center bg-gray-100 text-gray-500">Memuat Komponen Peta...</div>;

    return (
      <div className="relative h-[calc(100vh-60px)] w-full">
        {/* Floating Filter Panel */}
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 flex flex-col gap-2 min-w-[150px]">
          <div className="flex flex-col gap-1 border-b pb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kondisi Jalan</span>
            <select className="text-sm p-1 border border-gray-100 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-transparent cursor-pointer" value={filterCondition} onChange={e => setFilterCondition(e.target.value)}>
              <option>Semua</option><option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tahun Anggaran</span>
            <select className="text-sm p-1 border border-gray-100 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-transparent cursor-pointer" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option>Semua</option>
              {uniqueYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-20 left-4 z-[1000] bg-white/90 p-2 rounded shadow text-xs">
          <div className="font-bold mb-1">Legenda</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]"></div> Baik</div>
          <div className="flex items-center gap-2 mt-1"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div> Sedang</div>
          <div className="flex items-center gap-2 mt-1"><div className="w-3 h-3 rounded-full bg-[#f97316]"></div> Rusak Ringan</div>
          <div className="flex items-center gap-2 mt-1"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div> Rusak Berat</div>
        </div>
        <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }}></div>
      </div>
    );
  };

  // --- RENDER LAYOUT ---
  return (
    <div className="flex flex-col h-screen bg-white font-sans text-gray-800">
      <header className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-2">
          <MapPin className="text-blue-400" />
          <h1 className="font-bold text-lg leading-tight">GIS Kelurahan<span className="block text-xs text-slate-400 font-normal">Peta Sebaran Jalan</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isOnline ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative z-0">
        {activeTab === 'map' && <MapView />}
        {activeTab === 'input' && <UnifiedForm />}
        
        {toast.show && (
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[9999] px-4 py-2 rounded shadow-lg text-sm flex items-center gap-2 text-white animate-fade-in-down ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-green-600' : 'bg-slate-800'}`}>
            {toast.message} <button onClick={() => setToast({...toast, show: false})}><X size={14}/></button>
          </div>
        )}
      </main>

      <nav className="bg-white border-t flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <button onClick={() => setActiveTab('map')} className={`flex-1 flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'map' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}>
          <MapIcon size={24} />
          <span className="text-[10px] font-medium mt-1">Lihat Peta</span>
        </button>
        <button onClick={() => setActiveTab('input')} className={`flex-1 flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'input' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}>
          <PlusSquare size={24} />
          <span className="text-[10px] font-medium mt-1">Input Data</span>
        </button>
      </nav>
    </div>
  );
}