import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import confetti from 'canvas-confetti';

const BANNED_PATTERNS = ["nigger", "nigga", "faggot", "retard", "kike", "chink", "pedophile", "kys"];
function containsSlurs(text) {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return BANNED_PATTERNS.some(w => clean.includes(w));
}

export default function App() {
  const [tab, setTab] = useState('duel'); // duel | cook | hall | profile | admin
  const [flameTaps, setFlameTaps] = useState(0);

  // App Configuration
  const [adminPin, setAdminPin] = useState('1337');
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [votingOpen, setVotingOpen] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [adminBroadcast, setAdminBroadcast] = useState('');
  const [activeImage, setActiveImage] = useState('');
  const [activeCaption, setActiveCaption] = useState('');

  // Admin Cockpit
  const [enteredPin, setEnteredPin] = useState('');
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // User Profile
  const [username, setUsername] = useState(() => localStorage.getItem('c_user') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('c_avatar') || 'fa-hat-chef');
  const [title, setTitle] = useState(() => localStorage.getItem('c_title') || 'Line Cook');
  const [spices, setSpices] = useState(() => parseInt(localStorage.getItem('c_spices') || '25', 10));
  const [userStatus, setUserStatus] = useState('');
  const [isBanned, setIsBanned] = useState(false);

  // Direct Upload State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDrops, setPendingDrops] = useState([]);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  const [customUser, setCustomUser] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customMsg, setCustomMsg] = useState('');

  // Voting Loop
  const [captions, setCaptions] = useState([]);
  const [pair, setPair] = useState([0, 1]);
  const [votedChoice, setVotedChoice] = useState(null);

  // Hall of Fame Meme Canvas
  const [crownedMemeUrl, setCrownedMemeUrl] = useState(null);

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    if (username) {
      loadUserData();
      loadInbox();
    }
  }, [username]);

  // Generate initial random unique handle if none exists
  const initializeSession = async () => {
    let stored = localStorage.getItem('c_user');
    if (!stored) {
      stored = `@chef_${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('c_user', stored);
    }
    setUsername(stored);
    loadPlatformData();
  };

  const loadPlatformData = async () => {
    try {
      const { data: config } = await supabase.from('app_config').select('*').eq('id', 1).single();
      if (config) {
        setAdminPin(config.admin_pin || '1337');
        setSubmissionsOpen(config.submissions_open);
        setVotingOpen(config.voting_open);
        setMaintenanceMode(config.maintenance_mode);
        setAdminBroadcast(config.admin_broadcast || '');
        setActiveImage(config.active_image || '');
        setActiveCaption(config.active_caption || '');

        if (config.active_image && config.active_caption) {
          stitchServerHeader(config.active_caption, config.active_image, 'CROWNED CHAMPION');
        }
      }

      const { data: caps } = await supabase.from('captions').select('*').order('created_at', { ascending: false });
      if (caps && caps.length >= 2) setCaptions(caps);

      const { data: drops } = await supabase.from('drop_submissions').select('*').eq('status', 'pending');
      if (drops) setPendingDrops(drops);
    } catch (err) {
      console.error('Data sync failed:', err);
    }
  };

  const loadUserData = async () => {
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('username', username.toLowerCase()).single();
    if (profile) {
      if (profile.is_banned) {
        setIsBanned(true);
        return;
      }
      setAvatar(profile.avatar);
      setTitle(profile.title);
      setSpices(profile.spices);
      localStorage.setItem('c_avatar', profile.avatar);
      localStorage.setItem('c_title', profile.title);
      localStorage.setItem('c_spices', profile.spices.toString());
    } else {
      await supabase.from('user_profiles').insert([{
        username: username.toLowerCase(),
        avatar,
        title,
        spices
      }]);
    }
  };

  const loadInbox = async () => {
    const { data } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('target_username', username.toLowerCase())
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
  };

  const loadAllUsersForAdmin = async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    if (data) setAllUsers(data);
  };

  // Automated Canvas Meme Stitcher (Top Header Format)
  const stitchServerHeader = (text, imgUrl, author) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgUrl;

    img.onload = () => {
      const width = 800;
      const height = 800;
      const headerH = 180;
      canvas.width = width;
      canvas.height = height + headerH;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, headerH);

      ctx.fillStyle = "#000000";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = (text || "").toUpperCase().split(' ');
      let line = '';
      const lines = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > width - 80 && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      const startY = (headerH / 2) - ((lines.length - 1) * 20) - 10;
      lines.forEach((l, i) => {
        ctx.fillText(l.trim(), width / 2, startY + (i * 40));
      });

      ctx.font = "bold 15px monospace";
      ctx.fillStyle = "#ea580c";
      ctx.fillText(`COOKED.APP • ${author.toUpperCase()}`, width / 2, headerH - 22);

      ctx.drawImage(img, 0, headerH, width, height);
      setCrownedMemeUrl(canvas.toDataURL('image/png'));
    };
  };

  // Username Unique Check & Live Persistence
  const handleHandleChange = (e) => {
    let raw = e.target.value.toLowerCase().replace(/\s+/g, '');
    if (!raw.startsWith('@')) raw = '@' + raw.replace(/@/g, '');
    setUsername(raw);
    setUserStatus('Checking database...');
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username.length < 3) {
        setUserStatus('Minimum 3 characters');
        return;
      }
      const { data } = await supabase.from('user_profiles').select('username').eq('username', username.toLowerCase());
      if (data && data.length > 0 && username.toLowerCase() !== localStorage.getItem('c_user')?.toLowerCase()) {
        setUserStatus('⚠️ Handle already taken. Pick another.');
        return;
      }

      await supabase.from('user_profiles').upsert({
        username: username.toLowerCase(),
        avatar,
        title,
        spices
      }, { onConflict: 'username' });

      localStorage.setItem('c_user', username.toLowerCase());
      setUserStatus('✓ Handle unique & saved');
    }, 450);

    return () => clearTimeout(timer);
  }, [username, avatar, title]);

  // Direct File Upload to Supabase Storage
  const handleDirectFileUpload = async () => {
    if (!uploadFile) return alert('Select an image file from your device.');
    if (!uploadCaption.trim()) return alert('Provide a meme caption.');
    if (containsSlurs(uploadCaption)) return alert('Submission contains blocked slurs.');

    setIsUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `user_uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('memes')
        .upload(filePath, uploadFile, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('memes').getPublicUrl(filePath);

      const submissionPayload = {
        author: username.toLowerCase(),
        image_url: publicData.publicUrl,
        caption: uploadCaption.trim(),
        status: 'pending'
      };

      const { error: dbError } = await supabase.from('drop_submissions').insert([submissionPayload]);
      if (dbError) throw dbError;

      setUploadFile(null);
      setUploadCaption('');
      alert('Upload complete! Sent to admin for duel verification.');
      setTab('duel');
      loadPlatformData();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Voting Loop & Spices Reward Logic
  const handleVote = async (choice) => {
    if (!votingOpen || votedChoice !== null || captions.length < 2) return;
    setVotedChoice(choice);

    const now = Date.now();
    const lastVoted = parseInt(localStorage.getItem('c_last_voted') || '0', 10);
    if (now - lastVoted > 12 * 60 * 60 * 1000) {
      const updatedSpices = spices + 5;
      setSpices(updatedSpices);
      localStorage.setItem('c_spices', updatedSpices.toString());
      localStorage.setItem('c_last_voted', now.toString());

      await supabase.from('user_profiles').update({ spices: updatedSpices }).eq('username', username.toLowerCase());
      await supabase.from('user_notifications').insert([{
        target_username: username.toLowerCase(),
        title: '🔥 +5 Spices Claimed',
        message: 'You completed your 12-hour duel duty in the Arena.'
      }]);

      confetti({ particleCount: 90, spread: 60 });
    }

    const winner = choice === 'A' ? captions[pair[0]] : captions[pair[1]];
    const loser = choice === 'A' ? captions[pair[1]] : captions[pair[0]];

    if (winner && loser) {
      await supabase.rpc('record_duel_vote', { winner_id: winner.id, loser_id: loser.id });
    }
  };

  const nextDuel = () => {
    setVotedChoice(null);
    if (captions.length >= 2) {
      const a = Math.floor(Math.random() * captions.length);
      let b = Math.floor(Math.random() * captions.length);
      while (b === a) b = Math.floor(Math.random() * captions.length);
      setPair([a, b]);
    }
  };

  // Admin Cockpit Handlers
  const handleApproveSubmission = async (sub) => {
    await supabase.from('drop_submissions').update({ status: 'approved' }).eq('id', sub.id);
    await supabase.from('app_config').update({ active_image: sub.image_url, active_caption: sub.caption }).eq('id', 1);

    await supabase.from('user_notifications').insert([{
      target_username: sub.author.toLowerCase(),
      title: '🎉 Your Meme Was Crowned Live!',
      message: 'Your upload was approved by Admin and is now live in the Arena. +25 Spices awarded.'
    }]);

    const { data: targetProfile } = await supabase.from('user_profiles').select('spices').eq('username', sub.author.toLowerCase()).single();
    if (targetProfile) {
      await supabase.from('user_profiles').update({ spices: targetProfile.spices + 25 }).eq('username', sub.author.toLowerCase());
    }

    setActiveImage(sub.image_url);
    setActiveCaption(sub.caption);
    stitchServerHeader(sub.caption, sub.image_url, sub.author);
    setPendingDrops(pendingDrops.filter(x => x.id !== sub.id));
    alert(`Approved drop from ${sub.author}`);
  };

  const handleToggleUserBan = async (targetUser) => {
    const updatedStatus = !targetUser.is_banned;
    await supabase.from('user_profiles').update({ is_banned: updatedStatus }).eq('username', targetUser.username);
    setAllUsers(allUsers.map(u => u.username === targetUser.username ? { ...u, is_banned: updatedStatus } : u));
    alert(`${targetUser.username} is now ${updatedStatus ? 'BANNED' : 'UNBANNED'}.`);
  };

  const handleSendAdminInbox = async () => {
    if (!customUser || !customTitle || !customMsg) return alert('Fill out user, title, and message.');
    await supabase.from('user_notifications').insert([{
      target_username: customUser.toLowerCase().trim(),
      title: customTitle.trim(),
      message: customMsg.trim()
    }]);
    setCustomTitle('');
    setCustomMsg('');
    alert(`Sent to ${customUser}!`);
  };

  const currentCapA = captions[pair[0]] || captions[0];
  const currentCapB = captions[pair[1]] || captions[1];
  const totalVotes = ((currentCapA?.wins || 0) + (currentCapA?.losses || 0)) + ((currentCapB?.wins || 0) + (currentCapB?.losses || 0));
  const percentA = totalVotes === 0 ? 50 : Math.round((((currentCapA?.wins || 0) + (currentCapA?.losses || 0)) / totalVotes) * 100);
  const percentB = 100 - percentA;

  if (isBanned) {
    return (
      <div class="flex-1 flex flex-col items-center justify-center p-6 text-center bg-red-950 text-white min-h-screen">
        <i class="fa-solid fa-ban text-6xl text-red-500 mb-4 animate-bounce"></i>
        <h1 class="text-2xl font-black mb-2">Account Suspended</h1>
        <p class="text-xs text-red-300 max-w-xs">Your device and handle have been suspended for violating platform standards.</p>
      </div>
    );
  }

  return (
    <div class="flex-1 flex flex-col justify-between">
      {/* Broadcast Banner */}
      {adminBroadcast && (
        <div class="bg-red-600 px-4 py-2 text-xs font-black tracking-wide text-white flex justify-between items-center shadow-lg sticky top-0 z-30">
          <span class="truncate"><i class="fa-solid fa-bullhorn mr-1.5"></i>{adminBroadcast}</span>
          <button onClick={() => { setAdminBroadcast(''); supabase.from('app_config').update({ admin_broadcast: '' }).eq('id', 1); }}>✕</button>
        </div>
      )}

      {/* App Header */}
      <header class="p-4 flex items-center justify-between border-b border-slate-200 dark:border-[#1c2433] bg-white/90 dark:bg-[#111622]/90 backdrop-blur-md sticky top-0 z-20">
        <div class="flex items-center space-x-2">
          <button
            onClick={() => {
              const next = flameTaps + 1;
              if (next >= 3) { setFlameTaps(0); setTab('admin'); if (isAdminAuth) loadAllUsersForAdmin(); }
              else { setFlameTaps(next); setTimeout(() => setFlameTaps(0), 1200); }
            }}
            class="text-xl font-black text-orange-600 dark:text-orange-500 tracking-wider flex items-center space-x-1 active:scale-95 transition"
          >
            <i class="fa-solid fa-fire-flame-curved"></i>
            <span>COOKED</span>
          </button>
        </div>

        <div class="flex items-center space-x-2">
          <button
            onClick={() => setShowInbox(true)}
            class="relative w-8 h-8 rounded-full bg-slate-100 dark:bg-[#171f2e] border border-slate-300 dark:border-[#232e42] flex items-center justify-center text-xs active:scale-95"
          >
            <i class="fa-solid fa-bell"></i>
            {notifications.length > 0 && (
              <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-black"></span>
            )}
          </button>

          <div class="flex items-center space-x-1.5 text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-[#171f2e] border border-orange-200 dark:border-orange-500/20 px-2.5 py-1 rounded-full text-xs font-mono">
            <i class="fa-solid fa-pepper-hot"></i>
            <span>{spices}</span>
          </div>
        </div>
      </header>

      {/* Screen Routing */}
      {maintenanceMode && tab !== 'admin' ? (
        <div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <i class="fa-solid fa-screwdriver-wrench text-5xl text-orange-500 mb-4 animate-bounce"></i>
          <h2 class="text-xl font-black mb-2">Emergency Maintenance</h2>
          <p class="text-xs text-gray-500">The Arena database is undergoing maintenance. Battles resume shortly.</p>
        </div>
      ) : (
        <main class="flex-1 flex flex-col p-4 overflow-y-auto">

          {/* TAB 1: DUELS */}
          {tab === 'duel' && (
            <div class="flex-1 flex flex-col justify-between space-y-4">
              <div class="relative w-full h-64 bg-black rounded-2xl overflow-hidden border border-slate-200 dark:border-[#1e2638] shadow-2xl">
                {activeImage ? (
                  <img src={activeImage} class="w-full h-full object-cover" />
                ) : (
                  <div class="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
                    <i class="fa-regular fa-image text-3xl mb-2"></i>
                    <span>No active drop live yet. Submit one in Upload!</span>
                  </div>
                )}
                <div class="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-gray-300 border border-gray-700">
                  <i class="fa-solid fa-bolt text-amber-400 mr-1"></i>ACTIVE DROP
                </div>
              </div>

              {/* Matchups */}
              <div class="space-y-3">
                <button
                  disabled={!votingOpen}
                  onClick={() => handleVote('A')}
                  class={`w-full text-left p-4 rounded-xl border transition relative overflow-hidden ${
                    votedChoice === 'A'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-lg'
                      : votedChoice === 'B'
                      ? 'opacity-40 border-slate-200 dark:border-[#1e2638] bg-slate-50 dark:bg-[#111622]'
                      : 'border-slate-200 dark:border-[#1e2638] bg-slate-50 dark:bg-[#111622] active:scale-[0.98]'
                  }`}
                >
                  <p class="text-sm font-semibold leading-snug">{currentCapA?.text || 'Awaiting submissions...'}</p>
                  <div class="mt-2.5 flex justify-between items-center text-xs font-mono text-gray-500">
                    <span><i class="fa-solid fa-user-ninja mr-1"></i>{currentCapA?.author}</span>
                    {votedChoice !== null && <span class="text-emerald-500 font-bold">{percentA}%</span>}
                  </div>
                </button>

                <div class="text-center text-[10px] font-black text-gray-400 tracking-widest">- VS -</div>

                <button
                  disabled={!votingOpen}
                  onClick={() => handleVote('B')}
                  class={`w-full text-left p-4 rounded-xl border transition relative overflow-hidden ${
                    votedChoice === 'B'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-lg'
                      : votedChoice === 'A'
                      ? 'opacity-40 border-slate-200 dark:border-[#1e2638] bg-slate-50 dark:bg-[#111622]'
                      : 'border-slate-200 dark:border-[#1e2638] bg-slate-50 dark:bg-[#111622] active:scale-[0.98]'
                  }`}
                >
                  <p class="text-sm font-semibold leading-snug">{currentCapB?.text || 'Awaiting submissions...'}</p>
                  <div class="mt-2.5 flex justify-between items-center text-xs font-mono text-gray-500">
                    <span><i class="fa-solid fa-user-ninja mr-1"></i>{currentCapB?.author}</span>
                    {votedChoice !== null && <span class="text-emerald-500 font-bold">{percentB}%</span>}
                  </div>
                </button>
              </div>

              {votedChoice !== null ? (
                <button onClick={nextDuel} class="w-full py-3.5 bg-orange-600 hover:bg-orange-500 font-bold rounded-xl active:scale-95 text-white shadow-lg">
                  Next Duel →
                </button>
              ) : (
                <div class="flex justify-between items-center text-xs text-gray-500 px-2 font-medium">
                  <span>Vote every 12h for +5 Spices</span>
                  <button onClick={nextDuel} class="hover:text-orange-500">Skip <i class="fa-solid fa-forward-step ml-1"></i></button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIRECT UPLOAD MEMES */}
          {tab === 'cook' && (
            <div class="flex-1 flex flex-col justify-between space-y-4">
              <div>
                <h2 class="text-lg font-black mb-1 flex items-center space-x-2">
                  <i class="fa-solid fa-cloud-arrow-up text-orange-500"></i>
                  <span>Upload Meme File</span>
                </h2>
                <p class="text-xs text-gray-500 mb-4">Directly upload an image file from your device. Approved files go live in the Arena.</p>

                {!submissionsOpen ? (
                  <div class="p-4 bg-red-950/20 border border-red-800 rounded-xl text-center text-xs text-red-400">
                    🔒 Submissions are temporarily closed by Admin.
                  </div>
                ) : (
                  <div class="space-y-4">
                    <div class="border-2 border-dashed border-slate-300 dark:border-gray-700 rounded-2xl p-6 text-center">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        class="hidden"
                        id="memeFileInput"
                      />
                      <label htmlFor="memeFileInput" class="cursor-pointer flex flex-col items-center">
                        <i class="fa-solid fa-image text-3xl text-orange-500 mb-2"></i>
                        <span class="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {uploadFile ? uploadFile.name : 'Tap to select image from phone'}
                        </span>
                        <span class="text-[10px] text-gray-400 mt-1">PNG, JPG, WEBP up to 5MB</span>
                      </label>
                    </div>

                    <div>
                      <label class="text-xs font-bold text-gray-500 block mb-1">Meme Top Caption</label>
                      <textarea
                        placeholder="Write punchy caption text..."
                        value={uploadCaption}
                        onChange={(e) => setUploadCaption(e.target.value.slice(0, 65))}
                        class="w-full bg-slate-50 dark:bg-[#111622] border border-slate-300 dark:border-[#1e2638] rounded-xl p-3 text-xs h-20 resize-none focus:outline-none focus:border-orange-500"
                      ></textarea>
                    </div>
                  </div>
                )}
              </div>

              {submissionsOpen && (
                <button
                  disabled={isUploading}
                  onClick={handleDirectFileUpload}
                  class="w-full py-3.5 bg-orange-600 hover:bg-orange-500 font-bold rounded-xl active:scale-95 text-white text-xs shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <i class="fa-solid fa-upload"></i>
                  <span>{isUploading ? 'Uploading to Storage...' : 'Upload & Submit for Approval'}</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 3: HALL OF FAME */}
          {tab === 'hall' && (
            <div class="space-y-4">
              <h2 class="text-lg font-black mb-1 flex items-center space-x-2">
                <i class="fa-solid fa-trophy text-amber-500"></i>
                <span>Hall of Cooked</span>
              </h2>

              <div class="p-4 bg-slate-50 dark:bg-[#111622] rounded-2xl border border-slate-200 dark:border-[#1e2638] space-y-3 shadow-xl">
                {crownedMemeUrl ? (
                  <div class="rounded-xl overflow-hidden shadow border border-slate-300 dark:border-gray-800">
                    <img src={crownedMemeUrl} class="w-full h-auto block" />
                  </div>
                ) : (
                  <p class="text-xs text-gray-400 text-center py-8">No crowned meme generated yet.</p>
                )}

                <button
                  onClick={() => {
                    if (navigator.share && crownedMemeUrl) {
                      fetch(crownedMemeUrl).then(r => r.blob()).then(blob => {
                        const file = new File([blob], 'cooked-meme.png', { type: 'image/png' });
                        navigator.share({ title: 'Crowned on COOKED', files: [file] });
                      }).catch(() => alert('Saved image to clipboard!'));
                    } else if (crownedMemeUrl) {
                      const link = document.createElement('a');
                      link.download = `crowned-meme.png`;
                      link.href = crownedMemeUrl;
                      link.click();
                    }
                  }}
                  class="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 text-white shadow"
                >
                  <i class="fa-solid fa-share-nodes"></i>
                  <span>Share Crowned Meme</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE SETTINGS */}
          {tab === 'profile' && (
            <div class="space-y-4">
              <h2 class="text-lg font-black mb-1 flex items-center space-x-2">
                <i class="fa-solid fa-user-gear text-orange-500"></i>
                <span>Profile Settings</span>
              </h2>

              <div class="p-4 bg-slate-50 dark:bg-[#111622] rounded-2xl border border-slate-200 dark:border-[#1e2638] space-y-4 shadow-xl">
                <div class="flex items-center space-x-3">
                  <div class="w-14 h-14 bg-orange-100 dark:bg-orange-950/40 border border-orange-500/40 rounded-2xl flex items-center justify-center text-2xl text-orange-500">
                    <i class={`fa-solid ${avatar}`}></i>
                  </div>
                  <div>
                    <h3 class="font-black text-base">{username}</h3>
                    <p class="text-xs text-orange-500 font-mono font-bold">{title}</p>
                    <span class="text-[10px] text-gray-400 font-mono">Spices: {spices}</span>
                  </div>
                </div>

                <hr class="border-slate-200 dark:border-gray-800" />

                <div>
                  <label class="text-xs text-gray-500 font-medium block mb-1">Handle (Enforced Unique @)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={username}
                    onChange={handleHandleChange}
                    class="w-full bg-white dark:bg-black border border-slate-300 dark:border-gray-700 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                  />
                  <p class={`text-[10px] font-mono mt-1 ${userStatus.includes('⚠️') ? 'text-red-500' : 'text-emerald-500'}`}>{userStatus}</p>
                </div>

                <div>
                  <label class="text-xs text-gray-500 font-medium block mb-1">Avatar</label>
                  <div class="grid grid-cols-5 gap-2">
                    {['fa-hat-chef', 'fa-fire', 'fa-skull', 'fa-cat', 'fa-crown'].map(ic => (
                      <button
                        key={ic}
                        onClick={() => setAvatar(ic)}
                        class={`h-10 rounded-lg border flex items-center justify-center text-sm ${
                          avatar === ic ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-500' : 'border-slate-200 dark:border-gray-800 text-gray-400'
                        }`}
                      >
                        <i class={`fa-solid ${ic}`}></i>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADMIN MASTER COCKPIT */}
          {tab === 'admin' && (
            <div class="space-y-4">
              {!isAdminAuth ? (
                <div class="p-6 bg-slate-50 dark:bg-[#111622] rounded-2xl border border-red-500/40 text-center space-y-4 shadow-2xl">
                  <i class="fa-solid fa-shield-halved text-4xl text-red-500"></i>
                  <h3 class="font-bold">Admin Verification</h3>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Master PIN"
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    class="w-36 bg-white dark:bg-black border border-gray-700 rounded-lg p-2.5 text-center text-xl font-mono focus:border-red-500 focus:outline-none"
                  />
                  <div>
                    <button
                      onClick={() => {
                        if (enteredPin === adminPin) {
                          setIsAdminAuth(true);
                          setEnteredPin('');
                          loadAllUsersForAdmin();
                        } else alert('Access Denied');
                      }}
                      class="px-6 py-2.5 bg-red-600 font-bold rounded-xl text-xs text-white"
                    >
                      Authenticate
                    </button>
                  </div>
                </div>
              ) : (
                <div class="space-y-4 text-xs pb-10">
                  <div class="flex justify-between items-center bg-red-950/40 p-3 rounded-xl border border-red-800">
                    <span class="font-black text-red-400"><i class="fa-solid fa-radiation mr-1"></i>MASTER COCKPIT</span>
                    <button onClick={() => setIsAdminAuth(false)} class="text-[10px] bg-red-900/60 px-2.5 py-1 rounded font-bold text-white">Lock</button>
                  </div>

                  {/* 1. Direct Upload Approvals */}
                  <div class="bg-slate-50 dark:bg-[#111622] p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2638] space-y-2">
                    <h4 class="font-bold uppercase tracking-wider text-[11px] text-orange-500">Uploaded Memes Queue</h4>
                    {pendingDrops.length === 0 ? (
                      <p class="text-emerald-500 font-mono text-[10px]">✨ No pending uploads.</p>
                    ) : (
                      pendingDrops.map(sub => (
                        <div key={sub.id} class="p-2.5 bg-white dark:bg-black/40 rounded-lg border border-slate-200 dark:border-gray-800 flex items-center justify-between space-x-2">
                          <img src={sub.image_url} class="w-12 h-12 object-cover rounded" />
                          <div class="flex-1 truncate">
                            <span class="font-bold text-[10px] text-orange-400 block">{sub.author}</span>
                            <span class="text-gray-400 text-[10px] truncate block">{sub.caption}</span>
                          </div>
                          <div class="flex space-x-1">
                            <button onClick={() => handleApproveSubmission(sub)} class="bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold">Approve</button>
                            <button onClick={() => setPendingDrops(pendingDrops.filter(x => x.id !== sub.id))} class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold">Reject</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 2. User & Handle Management Suite */}
                  <div class="bg-slate-50 dark:bg-[#111622] p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2638] space-y-2">
                    <h4 class="font-bold uppercase tracking-wider text-[11px] text-orange-500">User & Handle Management</h4>
                    <input
                      type="text"
                      placeholder="Search registered handles..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value.toLowerCase())}
                      class="w-full bg-white dark:bg-black border border-slate-300 dark:border-gray-700 rounded p-1.5 text-[10px] font-mono mb-2"
                    />
                    <div class="max-h-48 overflow-y-auto space-y-1.5">
                      {allUsers
                        .filter(u => u.username.includes(userSearchQuery))
                        .map(u => (
                          <div key={u.id} class="p-2 bg-white dark:bg-black/30 rounded border border-slate-200 dark:border-gray-800 flex justify-between items-center">
                            <div class="truncate">
                              <span class="font-bold text-[10px] font-mono block">{u.username}</span>
                              <span class="text-[9px] text-gray-500">Spices: {u.spices} | {u.is_banned ? 'BANNED' : 'Active'}</span>
                            </div>
                            <div class="flex space-x-1">
                              <button
                                onClick={() => handleToggleUserBan(u)}
                                class={`px-2 py-1 rounded text-[9px] font-bold text-white ${u.is_banned ? 'bg-emerald-600' : 'bg-red-600'}`}
                              >
                                {u.is_banned ? 'Unban' : 'Ban'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Purge handle ${u.username}?`)) {
                                    await supabase.from('user_profiles').delete().eq('username', u.username);
                                    setAllUsers(allUsers.filter(x => x.username !== u.username));
                                  }
                                }}
                                class="bg-gray-700 px-2 py-1 rounded text-[9px] font-bold text-white"
                              >
                                Purge
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* 3. Direct Message Inbox Dispatcher */}
                  <div class="bg-slate-50 dark:bg-[#111622] p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2638] space-y-2">
                    <h4 class="font-bold uppercase tracking-wider text-[11px] text-orange-500">Send Notification to User</h4>
                    <input
                      type="text"
                      placeholder="Target @handle"
                      value={customUser}
                      onChange={(e) => setCustomUser(e.target.value)}
                      class="w-full bg-white dark:bg-black border border-slate-300 dark:border-gray-700 rounded p-1.5 text-[10px] font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Message Title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      class="w-full bg-white dark:bg-black border border-slate-300 dark:border-gray-700 rounded p-1.5 text-[10px]"
                    />
                    <textarea
                      placeholder="Message content..."
                      value={customMsg}
                      onChange={(e) => setCustomMsg(e.target.value)}
                      class="w-full bg-white dark:bg-black border border-slate-300 dark:border-gray-700 rounded p-1.5 text-[10px] h-12 resize-none"
                    ></textarea>
                    <button onClick={handleSendAdminInbox} class="w-full py-1.5 bg-orange-600 text-white font-bold rounded text-[10px]">
                      Send Notification
                    </button>
                  </div>

                  {/* 4. Kill Switches */}
                  <div class="bg-slate-50 dark:bg-[#111622] p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2638] space-y-2">
                    <h4 class="font-bold uppercase tracking-wider text-[11px] text-orange-500">Platform Switches</h4>
                    <div class="flex justify-between items-center">
                      <span>Allow Submissions</span>
                      <input type="checkbox" checked={submissionsOpen} onChange={(e) => { setSubmissionsOpen(e.target.checked); supabase.from('app_config').update({ submissions_open: e.target.checked }).eq('id', 1); }} class="w-4 h-4 accent-orange-500" />
                    </div>
                    <div class="flex justify-between items-center">
                      <span>Enable Arena Voting</span>
                      <input type="checkbox" checked={votingOpen} onChange={(e) => { setVotingOpen(e.target.checked); supabase.from('app_config').update({ voting_open: e.target.checked }).eq('id', 1); }} class="w-4 h-4 accent-orange-500" />
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-red-400 font-bold">Lock Behind Maintenance</span>
                      <input type="checkbox" checked={maintenanceMode} onChange={(e) => { setMaintenanceMode(e.target.checked); supabase.from('app_config').update({ maintenance_mode: e.target.checked }).eq('id', 1); }} class="w-4 h-4 accent-red-600" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* Inbox Modal */}
      {showInbox && (
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-[#111622] border border-slate-200 dark:border-[#1e2638] w-full max-w-sm rounded-2xl p-5 space-y-3 shadow-2xl">
            <div class="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-gray-800">
              <h3 class="font-black text-sm text-orange-500"><i class="fa-solid fa-inbox mr-1.5"></i>Inbox</h3>
              <button onClick={() => setShowInbox(false)}>✕</button>
            </div>
            <div class="max-h-60 overflow-y-auto space-y-2">
              {notifications.length === 0 ? (
                <p class="text-xs text-gray-400 text-center py-4">No notifications yet.</p>
              ) : (
                notifications.map((n, i) => (
                  <div key={i} class="p-2.5 bg-slate-50 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-gray-800 space-y-1">
                    <p class="font-bold text-xs">{n.title}</p>
                    <p class="text-[11px] text-gray-500">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <nav class="h-16 bg-white dark:bg-[#111622] border-t border-slate-200 dark:border-[#1c2433] flex items-center justify-around fixed bottom-0 left-0 right-0 max-w-md mx-auto z-10">
        <button onClick={() => setTab('duel')} class={`flex flex-col items-center ${tab === 'duel' ? 'text-orange-500' : 'text-gray-400'}`}>
          <i class="fa-solid fa-fire text-lg"></i>
          <span class="text-[10px] font-bold mt-1">Duel</span>
        </button>
        <button onClick={() => setTab('cook')} class={`flex flex-col items-center ${tab === 'cook' ? 'text-orange-500' : 'text-gray-400'}`}>
          <i class="fa-solid fa-cloud-arrow-up text-lg"></i>
          <span class="text-[10px] font-bold mt-1">Upload</span>
        </button>
        <button onClick={() => setTab('hall')} class={`flex flex-col items-center ${tab === 'hall' ? 'text-orange-500' : 'text-gray-400'}`}>
          <i class="fa-solid fa-trophy text-lg"></i>
          <span class="text-[10px] font-bold mt-1">Hall</span>
        </button>
        <button onClick={() => setTab('profile')} class={`flex flex-col items-center ${tab === 'profile' ? 'text-orange-500' : 'text-gray-400'}`}>
          <i class="fa-solid fa-user-gear text-lg"></i>
          <span class="text-[10px] font-bold mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
}
