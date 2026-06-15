import React, { useState, useEffect, useRef } from 'react';
import { 
  Map as MapIcon, PlusSquare, Navigation, Save, 
  Wifi, WifiOff, Camera, MapPin, Activity, X, Download, Database
} from 'lucide-react';

// --- SUPABASE INITIALIZATION ---
// PENTING: Saat Anda menyalin kode ini ke project Vite Anda di komputer, 
// silakan HAPUS tanda komentar (//) pada 4 baris kode di bawah ini:

// import { createClient } from '@supabase/supabase-js';
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Untuk keperluan preview di halaman ini agar tidak terjadi error kompilasi, 
// kita tetapkan supabase sebagai null (KODE INI HARUS DIKOMENTARI ATAU DIHAPUS DI STACKBLITZ):
const supabase = null;

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
  const [activeTab, setActiveTab] = useState('map'); 
  const [roadsData, setRoadsData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true); document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const fetchRoads = async () => {
      if (!supabase) {
        setRoadsData([]);
        return;
      }
      const { data, error } = await supabase.from('roads').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setRoadsData(data || []);
      }
    };

    fetchRoads();

    if (!supabase) return;
    const subscription = supabase
      .channel('public:roads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roads' }, (payload) => {
        fetchRoads(); 
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(subscription);
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

  const MiniMap = ({ path, isTracking }) => {
    const mapRef = useRef(null); 
    const mapInstance = useRef(null); 
    const polylineRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
      if (!window.L || !mapRef.current || path.length === 0) return;
      const lastPoint = path[path.length - 1];
      
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView(lastPoint, 17);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
      }

      // 1. Gambar Garis (Polyline) jika ada lebih dari 1 titik
      if (polylineRef.current) mapInstance.current.removeLayer(polylineRef.current);
      if (path.length > 1) {
        polylineRef.current = window.L.polyline(path, { color: '#3b82f6', weight: 5 }).addTo(mapInstance.current);
      }

      // 2. Gambar Titik Merah (Marker) di posisi terakhir agar langsung terlihat saat merekam
      if (markerRef.current) mapInstance.current.removeLayer(markerRef.current);
      markerRef.current = window.L.circleMarker(lastPoint, { 
        radius: 6, color: '#ffffff', weight: 2, fillOpacity: 1, fillColor: '#ef4444' 
      }).addTo(mapInstance.current);

      // 3. Atur pandangan peta
      if (isTracking) {
        // Jika sedang merekam, kamera selalu mengikuti titik terakhir
        mapInstance.current.setView(lastPoint, 17);
      } else if (path.length > 1 && polylineRef.current) {
        // Jika sudah STOP merekam, sesuaikan kamera (zoom out) agar seluruh garis terlihat
        mapInstance.current.fitBounds(polylineRef.current.getBounds(), { padding: [15, 15] });
      }

    }, [path, isTracking]);

    return <div ref={mapRef} className="h-full w-full rounded-xl z-0 pointer-events-none" />;
  };

  const UnifiedForm = () => {
    const [showPicker, setShowPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
      roadName: '', condition: 'Baik',
      description: '', photos: [], surfaceTypes: [],
      lat: '', lng: '', accuracy: 0
    });

    const [isTracking, setIsTracking] = useState(false);
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
      if (!navigator.geolocation) return showToast("GPS tidak didukung oleh browser ini", "error");
      showToast("Mengambil lokasi...", "info");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }));
          showToast(`Lokasi didapat! Akurasi: ${Math.round(pos.coords.accuracy)}m`, "success");
        },
        (err) => {
          if (err.message.includes("permissions policy") || err.code === 1) {
            showToast("Akses GPS diblokir. Silakan gunakan 'Pilih di Peta'.", "error");
          } else {
            showToast(`Gagal GPS: ${err.message}`, "error");
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const toggleTracking = () => {
      if (isTracking) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        setIsTracking(false); 
        showToast("Perekaman dihentikan", "info");
      } else {
        if (!navigator.geolocation) return showToast("GPS tidak didukung", "error");
        setPath([]); setDistance(0); setIsTracking(true); 
        showToast("Mulai merekam jalur...", "success");

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            // Toleransi akurasi diperlebar (100) agar saat dites rekaman GPS lebih mudah tertangkap
            if (accuracy > 100) return; 
            
            setPath(prevPath => {
              const newPoint = [latitude, longitude];
              if (prevPath.length > 0) {
                const lastPoint = prevPath[prevPath.length - 1];
                const dist = calculateDistance(lastPoint[0], lastPoint[1], latitude, longitude);
                // Jarak minimal pergerakan diperkecil jadi 1 meter agar lebih responsif
                if (dist > 1) { 
                  setDistance(d => d + dist); 
                  return [...prevPath, newPoint]; 
                }
                return prevPath;
              }
              // Catat titik pertama langsung
              return [newPoint];
            });
          },
          (err) => {
             setIsTracking(false);
             if (err.message.includes("permissions policy") || err.code === 1) {
                showToast("Akses GPS diblokir oleh browser.", "error");
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
          type: "Feature", properties: { name: formData.roadName, distance: distance, year: new Date().getFullYear() },
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
        roadName: formData.roadName,
        condition: formData.condition,
        year: new Date().getFullYear(),
        surfaceTypes: formData.surfaceTypes || [],
        description: formData.description,
        photos: formData.photos || [],
        surveyDate: new Date().toISOString()
      };

      // Keduanya bisa disimpan bersamaan (titik dan track)
      if (path.length >= 2) {
        basePayload.trackPath = path;
        basePayload.distanceMeters = Math.round(distance);
      }
      
      if (formData.lat && formData.lng) {
        basePayload.location = { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) };
      }

      setIsSaving(true);
      try {
        if (!supabase) {
          // MODE PREVIEW: Simpan ke state memori lokal agar tampil di Peta
          setRoadsData(prevData => [{ ...basePayload, id: Date.now(), created_at: new Date().toISOString() }, ...prevData]);
          showToast("Disimpan sementara (Mode Preview Lokal)", "success");
        } else {
          // MODE PRODUCTION: Simpan ke Supabase sungguhan
          const { error } = await supabase.from('roads').insert([basePayload]);
          if (error) throw error;
          showToast("Data berhasil disimpan ke Supabase!", "success");
        }

        setFormData({ roadName: '', condition: 'Baik', description: '', photos: [], surfaceTypes: [], lat: '', lng: '', accuracy: 0 });
        setPath([]); setDistance(0);
        setActiveTab('map');
      } catch (err) {
        showToast(`Error: ${err.message}`, "error");
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6 max-w-2xl mx-auto pb-36">
        <h2 className="text-2xl font-bold border-b border-slate-200 pb-3 text-slate-800">
          Input Data Jalan
        </h2>

        {/* 1. Titik Lokasi */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">1. Titik Lokasi (Bisa dikosongkan jika hanya merekam track)</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={getGPS} className="flex-1 bg-blue-100 text-blue-700 py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-blue-200 active:scale-[0.98] transition-transform font-bold shadow-sm text-sm">
              <Navigation size={18} /> Deteksi Otomatis
            </button>
            <button type="button" onClick={() => setShowPicker(true)} className="flex-1 bg-white text-slate-700 py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-slate-50 border border-slate-200 active:scale-[0.98] transition-transform font-bold shadow-sm text-sm">
              <MapIcon size={18} /> Pilih di Peta
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="any" placeholder="Latitude" className="w-full p-3 border border-slate-300 rounded-xl text-[15px] bg-slate-50 shadow-inner focus:outline-none"
              value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} />
            <input type="number" step="any" placeholder="Longitude" className="w-full p-3 border border-slate-300 rounded-xl text-[15px] bg-slate-50 shadow-inner focus:outline-none"
              value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} />
          </div>
          {formData.accuracy > 0 && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><Wifi size={12}/> Akurasi GPS: ±{formData.accuracy} meter</p>}
        </div>

        {/* 2. Nama Jalan */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">2. Nama Jalan</label>
          <input required type="text" placeholder="Cth: Jl. Ahmad Yani" className="w-full p-3 border border-slate-300 rounded-xl text-[15px] shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={formData.roadName} onChange={e => setFormData({...formData, roadName: e.target.value})} />
        </div>

        {/* 3. Kondisi Jalan */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">3. Kondisi Jalan</label>
          <select className="w-full p-3 border border-slate-300 rounded-xl text-[15px] shadow-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})}>
            <option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
          </select>
        </div>

        {/* 4. Jalan Saat Ini */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">4. Jalan Saat Ini (Jenis Permukaan)</label>
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
          <textarea rows="3" placeholder="Tambahkan keterangan kondisi jalan / situasi..." className="w-full p-3 border border-slate-300 rounded-xl text-[15px] shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
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

        {/* 7. Track GPS */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">7. Rekam Jalur (Bisa dikosongkan jika hanya mengirim titik lokasi)</label>
          <div className="bg-slate-800 text-white p-5 rounded-2xl shadow-inner text-center relative overflow-hidden">
            <div className="text-3xl font-mono mb-1 font-bold">
              {(distance / 1000).toFixed(2)} <span className="text-base text-slate-300 font-sans">KM</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Jarak Terekam</p>
            <div className="mt-4">
              <button type="button" onClick={toggleTracking}
                className={`w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] shadow-lg flex justify-center items-center gap-2 ${isTracking ? 'bg-red-500 hover:bg-red-600 animate-pulse' : (path.length > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600')}`}>
                {isTracking ? <><X size={20}/> Stop Perekaman</> : (path.length > 0 ? <><Activity size={20}/> Ulangi Rekam Track</> : <><Activity size={20}/> Mulai Rekam Track</>)}
              </button>
            </div>

            {/* Indikator Status Perekaman */}
            {isTracking && path.length === 0 && (
              <div className="mt-4 text-sm text-yellow-300 animate-pulse flex justify-center items-center gap-2 font-medium">
                <Activity size={16}/> Mencari Sinyal GPS...
              </div>
            )}
            {isTracking && path.length === 1 && (
              <div className="mt-4 text-sm text-green-300 flex justify-center items-center gap-2 font-medium">
                <MapPin size={16}/> Titik awal didapat. Silakan mulai bergerak.
              </div>
            )}

            {path.length > 0 && leafletLoaded && (
              <div className="h-40 w-full rounded-xl overflow-hidden border-2 border-slate-700 mt-4 shadow-inner relative">
                {isTracking && (
                  <div className="absolute top-2 left-2 z-[1000] bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-md animate-pulse font-black tracking-widest">
                    REC
                  </div>
                )}
                <MiniMap path={path} isTracking={isTracking} />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-200">
          <button disabled={isSaving || isTracking} type="submit" 
            className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/30">
            <Save size={22} /> {isSaving ? 'Menyimpan...' : 'Simpan Data Peta'}
          </button>
          {path.length >= 2 && (
            <button type="button" onClick={downloadGeoJSON} disabled={isTracking} className="bg-slate-200 text-slate-700 px-5 rounded-xl font-bold disabled:opacity-50 flex justify-center items-center active:scale-[0.98] transition-transform" title="Download GeoJSON">
              <Download size={22} />
            </button>
          )}
        </div>

        {showPicker && (
          <MapPicker initialLat={formData.lat} initialLng={formData.lng} onSelect={(lat, lng) => setFormData({...formData, lat, lng, accuracy: 0})} onClose={() => setShowPicker(false)} />
        )}
      </form>
    );
  };

  const MapView = () => {
    const [filterCondition, setFilterCondition] = useState('Semua');
    const [filterYear, setFilterYear] = useState('Semua');
    const mapRef = useRef(null); const mapInstance = useRef(null);
    const markersGroup = useRef(null); const boundaryLayer = useRef(null);
    const center = [-0.485, 117.155];

    const uniqueYears = Array.from(new Set(roadsData.map(r => r.year).filter(Boolean))).sort((a, b) => b - a);

    // Filter data roads untuk ditampilkan dan dihitung legendanya
    const filteredRoads = roadsData.filter(road => {
      const matchCondition = filterCondition === 'Semua' ? true : road.condition === filterCondition;
      const matchYear = filterYear === 'Semua' ? true : String(road.year) === String(filterYear);
      return matchCondition && matchYear;
    });

    // Hitung jumlah statistik untuk Legenda berdasarkan data yang sedang tampil (difilter)
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

        // Pindahkan kontrol zoom ke kiri atas agar tidak tertutup jari/legenda di HP
        window.L.control.zoom({ position: 'topleft' }).addTo(mapInstance.current);

        boundaryLayer.current = window.L.geoJSON(batasKelurahanGeoJSON, {
          style: function () { return { color: "#0ea5e9", weight: 3, opacity: 1, fillOpacity: 0.05, fillColor: "#0ea5e9" }; },
          interactive: false
        });

        boundaryLayer.current.addTo(mapInstance.current);
        window.L.control.layers({ "Street Map (OSM)": osm, "Citra Satelit (Esri)": esri }, { "Batas Wilayah": boundaryLayer.current }).addTo(mapInstance.current);

        setTimeout(() => {
          if (mapInstance.current && boundaryLayer.current) {
            mapInstance.current.invalidateSize(); mapInstance.current.fitBounds(boundaryLayer.current.getBounds(), { padding: [10, 10] });
          }
        }, 250);

        markersGroup.current = window.L.layerGroup().addTo(mapInstance.current);
      }

      if (markersGroup.current) markersGroup.current.clearLayers();

      const createCustomIcon = (color) => window.L.divIcon({ className: 'custom-leaflet-icon', html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
      const icons = { 'Baik': createCustomIcon('#22c55e'), 'Sedang': createCustomIcon('#eab308'), 'Rusak Ringan': createCustomIcon('#f97316'), 'Rusak Berat': createCustomIcon('#ef4444'), 'default': createCustomIcon('#3b82f6') };
      const getPolylineColor = (condition) => { switch(condition) { case 'Baik': return '#22c55e'; case 'Sedang': return '#eab308'; case 'Rusak Ringan': return '#f97316'; case 'Rusak Berat': return '#ef4444'; default: return '#3b82f6'; } };

      filteredRoads.forEach(road => {
        const photoHTML = road.photos && road.photos.length > 0 ? `<div style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 0.75rem; padding-bottom: 4px;">${road.photos.map(p => `<img src="${p}" style="height: 80px; min-width: 80px; border-radius: 8px; object-fit: cover; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" />`).join('')}</div>` : '';
        const videoHTML = road.videoUrl ? `<a href="${road.videoUrl}" target="_blank" style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: bold; color: #fff; background-color: #ef4444; padding: 6px 12px; border-radius: 6px; text-decoration: none; margin-bottom: 0.75rem; width: fit-content; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);">▶️ Tonton Video</a>` : '';

        // Template Pop Up Peta Lengkap
        const popupContent = `
            <div style="min-width: 220px; font-family: sans-serif;">
              <h3 style="font-weight: 800; font-size: 1.25rem; margin-bottom: 0.75rem; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">${road.roadName}</h3>
              ${photoHTML}${videoHTML}
              <div style="font-size: 0.85rem; margin-bottom: 0.75rem; background-color: #f8fafc; padding: 0.75rem; border-radius: 0.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border: 1px solid #e2e8f0;">
                <div style="grid-column: span 2;"><span style="color: #64748b; display: block; font-size: 0.75rem;">Permukaan:</span> <b style="color: #334155;">${road.surfaceTypes && road.surfaceTypes.length > 0 ? road.surfaceTypes.join(', ') : '-'}</b></div>
                <div><span style="color: #64748b; display: block; font-size: 0.75rem;">Kondisi:</span> <b style="color: #334155;">${road.condition}</b></div>
                <div><span style="color: #64748b; display: block; font-size: 0.75rem;">Tahun:</span> <b style="color: #334155;">${road.year || '-'}</b></div>
                ${road.trackPath && road.trackPath.length > 0 ? `<div style="grid-column: span 2;"><span style="color: #64748b; display: block; font-size: 0.75rem;">Panjang Jalur:</span> <b style="color: #334155;">${(road.distanceMeters / 1000).toFixed(2)} km</b></div>` : ''}
              </div>
              ${road.description ? `<p style="font-size: 0.85rem; font-style: italic; background-color: #fefce8; padding: 0.5rem; border-left: 3px solid #facc15; margin-bottom: 0.75rem; border-radius: 0 0.25rem 0.25rem 0; color: #854d0e;">"${road.description}"</p>` : ''}
              <p style="font-size: 0.7rem; color: #94a3b8; text-align: right;">Disurvei: ${new Date(road.surveyDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p>
            </div>
          `;

        // Keduanya bisa di-render secara bersamaan jika data keduanya ada (titik & garis)
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
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Kondisi Jalan</span>
            <select className="text-sm p-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer font-medium text-slate-700" value={filterCondition} onChange={e => setFilterCondition(e.target.value)}>
              <option>Semua</option><option>Baik</option><option>Sedang</option><option>Rusak Ringan</option><option>Rusak Berat</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Tahun Dana</span>
            <select className="text-sm p-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer font-medium text-slate-700" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option>Semua</option>
              {uniqueYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </div>
        </div>

        {/* Legend Dinamis dengan Jumlah Angka */}
        <div className="absolute bottom-6 left-3 z-[1000] bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg text-xs border border-slate-100 font-medium text-slate-700 min-w-[160px]">
          <div className="font-extrabold mb-3 text-slate-800 border-b pb-1.5 flex justify-between">
            <span>Legenda & Statistik</span>
            <span className="bg-slate-200 text-[10px] px-1.5 py-0.5 rounded-full">{filteredRoads.length} Total</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#22c55e] shadow-sm border border-white"></div> Baik</div>
            <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{countBaik}</span>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2.5">
            <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#eab308] shadow-sm border border-white"></div> Sedang</div>
            <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{countSedang}</span>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2.5">
            <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#f97316] shadow-sm border border-white"></div> Rusak Ringan</div>
            <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{countRusakRingan}</span>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2.5">
            <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#ef4444] shadow-sm border border-white"></div> Rusak Berat</div>
            <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{countRusakBerat}</span>
          </div>
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
          <div>
            <h1 className="font-extrabold text-lg leading-tight tracking-tight">GIS Kelurahan</h1>
            <span className="block text-[11px] text-blue-200 font-medium">Peta Sebaran Jalan</span>
          </div>
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

      {/* Mobile Friendly Bottom Navigation */}
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
