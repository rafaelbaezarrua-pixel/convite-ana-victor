document.addEventListener('DOMContentLoaded', () => {
    const envelope = document.getElementById('envelope');
    const openBtn = document.getElementById('open-btn');
    const invitationContent = document.getElementById('invitation-content');
    const rsvpForm = document.getElementById('rsvp-form');
    const addCompanionBtn = document.getElementById('add-companion');
    const companionsContainer = document.getElementById('companions-container');
    const linkedEditToken = new URLSearchParams(window.location.hash.slice(1)).get('edit');
    let activeEditToken = null;

    // Supabase Configuration
    // Initialize countdown if elements exist
    if (document.getElementById('days')) {
        const weddingDate = new Date('2026-11-21T16:00:00-03:00').getTime();

        const countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = weddingDate - now;

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            document.getElementById('days').innerText = String(days).padStart(2, '0');
            document.getElementById('hours').innerText = String(hours).padStart(2, '0');
            document.getElementById('minutes').innerText = String(minutes).padStart(2, '0');
            document.getElementById('seconds').innerText = String(seconds).padStart(2, '0');

            if (distance < 0) {
                clearInterval(countdownInterval);
                document.getElementById('countdown').innerHTML = "O Grande Dia Chegou!";
            }
        }, 1000);
    }

    const _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
        auth: { persistSession: false }
    });

    // Gift List URL
    const GIFT_LIST_URL = 'https://site.lejour.com.br/lista-de-presentes/ana-e-victor261121';

    // 0. Check if user already confirmed
    if (localStorage.getItem('rsvp_confirmed')) {
        // If already confirmed, logic is handled in renderRSVPStatus()
    }

    // 1. Envelope Opening Animation
    openBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent duplicate triggers
        envelope.classList.add('open');
        
        // Iniciar música
        const music = document.getElementById('bg-music');
        if (music && music.src && music.src !== window.location.href) {
            music.play().catch(e => console.log("Auto-play blocked, interaction needed"));
        }

        // Mostrar botão flutuante de som
        const musicToggle = document.getElementById('music-toggle');
        if (musicToggle) musicToggle.style.display = 'flex';

        // Disparar Confetes
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#c2a688', '#ffffff', '#e6d5c3']
            });
        }
        
        // Wait for animation to finish before showing content
        setTimeout(() => {
            document.body.classList.add('opened');
            envelope.style.display = 'none';
            invitationContent.style.display = 'block';
            
            // Iniciar animações de scroll
            initScrollAnimations();
            
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }, 1000);
    });

    // 2. Add Companion Logic
    function addCompanionInput(name = '', age = '') {
        const companionId = Date.now();
        const companionDiv = document.createElement('div');
        companionDiv.className = 'companion-item';
        companionDiv.id = `companion-${companionId}`;
        
        companionDiv.innerHTML = `
            <input type="text" placeholder="Nome do acompanhante" class="companion-input" aria-label="Nome do acompanhante" required>
            <input type="number" min="0" max="120" placeholder="Idade" class="companion-age-input" aria-label="Idade do acompanhante" required>
            <button type="button" class="remove-companion" title="Remover">×</button>
        `;

        companionDiv.querySelector('.companion-input').value = name;
        companionDiv.querySelector('.companion-age-input').value = age;
        
        companionsContainer.appendChild(companionDiv);

        // Remove companion event
        companionDiv.querySelector('.remove-companion').addEventListener('click', () => {
            companionDiv.remove();
        });
    }

    addCompanionBtn.addEventListener('click', () => addCompanionInput());

    // 3. Form Submission
    rsvpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = rsvpForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        const guestName = document.getElementById('guest-name').value.trim();
        const guestAge = Number(document.getElementById('guest-age').value);
        const companionInputs = document.querySelectorAll('.companion-input');
        const companions = Array.from(companionInputs).map(input => {
            const age = input.closest('.companion-item').querySelector('.companion-age-input').value;
            return { name: input.value.trim(), age: Number(age) };
        });

        const rsvpData = {
            name: guestName,
            age: guestAge,
            companions: companions
        };

        const isEditing = Boolean(activeEditToken);
        let error;
        if (isEditing) {
            ({ error } = await _supabase.rpc('update_rsvp_with_edit_token', {
                p_edit_token: activeEditToken,
                p_name: rsvpData.name,
                p_age: rsvpData.age,
                p_companions: rsvpData.companions
            }));
        } else {
            const editToken = crypto.randomUUID();
            ({ error } = await _supabase
                .from('rsvps')
                .insert([{ ...rsvpData, edit_token: editToken }]));
            if (!error) activeEditToken = editToken;
        }

        if (error) {
            console.error('Error saving to Supabase:', error);
            alert(isEditing ? 'Erro ao atualizar a presença. Por favor, tente novamente.' : 'Erro ao confirmar presença. Por favor, tente novamente.');
            submitBtn.disabled = false;
            submitBtn.textContent = isEditing ? 'Salvar alterações' : 'Confirmar Presença';
            return;
        }

        // Mark as confirmed for this device
        localStorage.setItem('rsvp_confirmed', 'true');
        localStorage.setItem('rsvp_edit_token', activeEditToken);

        if (isEditing) {
            alert('Presença atualizada com sucesso!');
            history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            renderRSVPStatus();
            return;
        }

        alert('Presença confirmada com sucesso! Você será redirecionado para a lista de presentes.');
        
        // 4. Redirect to Gift List
        window.location.href = GIFT_LIST_URL;
    });

    function renderRSVPStatus() {
        const rsvpSection = document.querySelector('.rsvp-section');
        const form = document.getElementById('rsvp-form');
        if (!rsvpSection || !form) return;

        let status = rsvpSection.querySelector('.rsvp-status-message');
        if (!localStorage.getItem('rsvp_confirmed')) {
            form.style.display = '';
            status?.remove();
            return;
        }

        form.style.display = 'none';
        if (!status) {
            status = document.createElement('div');
            status.className = 'rsvp-status-message';
            status.style.cssText = 'text-align: center; padding: 20px; background: #f9f9f9; border-radius: 12px; border: 1px solid var(--primary);';
            status.innerHTML = `
                <h3 style="color: var(--primary); margin-bottom: 10px;">Presença já Confirmada!</h3>
                <p>Obrigado por confirmar sua presença. Mal podemos esperar para celebrar com você!</p>
                <button type="button" class="btn" id="edit-presence-button" style="display: inline-block; margin-top: 12px; width: auto; padding: 12px 30px;">Editar presença</button>
                <p style="font-size: 0.85rem; color: #777; margin-top: 12px;">Confirmações antigas precisam do link individual de edição enviado pelo administrador.</p>
                <a href="${GIFT_LIST_URL}" class="btn" style="display: inline-block; margin-top: 8px; text-decoration: none;">Ver Lista de Presentes</a>
            `;
            rsvpSection.appendChild(status);
        }

        status.querySelector('#edit-presence-button').onclick = async () => {
            let token = localStorage.getItem('rsvp_edit_token');
            if (!token) {
                const suppliedValue = prompt('Cole aqui seu link ou código individual de edição:');
                token = extractEditToken(suppliedValue);
            }
            if (token) await loadRSVPForEditing(token);
        };
    }

    function extractEditToken(value) {
        const match = String(value || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        return match ? match[0] : null;
    }

    function getGuestDetails(name, age) {
        let cleanName = name || '';
        let cleanAge = age ?? '';
        const legacyAge = typeof cleanName === 'string' ? cleanName.match(/\s+\((\d+) anos?\)$/) : null;
        if (cleanAge === '' && legacyAge) {
            cleanAge = Number(legacyAge[1]);
            cleanName = cleanName.slice(0, legacyAge.index);
        }
        return { name: cleanName, age: cleanAge };
    }

    function getCompanionDetails(companion) {
        return companion && typeof companion === 'object'
            ? getGuestDetails(companion.name, companion.age)
            : getGuestDetails(companion, '');
    }

    async function loadRSVPForEditing(token) {
        const { data, error } = await _supabase.rpc('get_rsvp_for_edit', { p_edit_token: token });
        const rsvpSection = document.querySelector('.rsvp-section');
        if (error || !data) {
            console.error('Error loading RSVP for editing:', error);
            rsvpSection.innerHTML = '<div style="text-align:center;padding:24px;"><h3>Link de edição inválido</h3><p>Peça ao administrador um novo link individual.</p></div>';
            return;
        }

        activeEditToken = token;
        rsvpSection.querySelector('.rsvp-status-message')?.remove();
        rsvpForm.style.display = '';
        rsvpSection.querySelector('h2').textContent = 'Editar presença';
        rsvpSection.querySelector('p').textContent = 'Atualize seus dados e os de seus acompanhantes.';

        const guest = getGuestDetails(data.name, data.age);
        document.getElementById('guest-name').value = guest.name;
        document.getElementById('guest-age').value = guest.age;
        companionsContainer.innerHTML = '';
        (data.companions || []).map(getCompanionDetails).forEach(companion => {
            addCompanionInput(companion.name, companion.age);
        });
        rsvpForm.querySelector('button[type="submit"]').textContent = 'Salvar alterações';
        rsvpSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function loadGallerySettings() {
        const { data, error } = await _supabase
            .from('invitation_settings')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (data) {
            // Galeria
            const galleryItems = document.querySelectorAll('.gallery-item img');
            if (galleryItems[0] && data.gallery_1) galleryItems[0].src = data.gallery_1;
            if (galleryItems[1] && data.gallery_2) galleryItems[1].src = data.gallery_2;
            if (galleryItems[2] && data.gallery_3) galleryItems[2].src = data.gallery_3;
            if (galleryItems[3] && data.gallery_4) galleryItems[3].src = data.gallery_4;

            // Música
            const music = document.getElementById('bg-music');
            if (music) {
                if (data.music_enabled === false) {
                    music.pause();
                    music.src = ""; // Remove a fonte para garantir silêncio
                } else if (data.music_url && data.music_url.trim() !== "") {
                    // Só atualiza se o link for diferente do atual para evitar "pulos" no áudio
                    if (music.src !== data.music_url) {
                        music.src = data.music_url;
                        music.load();
                    }
                }
            }
        }
    }

    // Call this to handle initial state
    if (linkedEditToken) loadRSVPForEditing(linkedEditToken);
    else renderRSVPStatus();
    loadGallerySettings();

    // Pausar música ao sair da aba/navegador
    document.addEventListener('visibilitychange', () => {
        const music = document.getElementById('bg-music');
        if (music) {
            if (document.hidden) {
                music.pause();
            } else {
                // Só volta a tocar se o convite já tiver sido aberto
                if (document.body.classList.contains('opened')) {
                    music.play().catch(e => console.log("Playback resumed"));
                }
            }
        }
    });

    // --- NOVAS FUNÇÕES ---

    // Remover Loader
    window.addEventListener('load', () => {
        const loader = document.getElementById('loader');
        if (loader) {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.visibility = 'hidden', 800);
            }, 1000);
        }
        initDynamicBg();
    });

    // Controle de Som Flutuante
    const musicToggle = document.getElementById('music-toggle');
    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            const music = document.getElementById('bg-music');
            const icon = musicToggle.querySelector('.icon');
            if (music.paused) {
                music.play();
                icon.textContent = '🔊';
            } else {
                music.pause();
                icon.textContent = '🔇';
            }
        });
    }

    // Fundo Dinâmico (Partículas)
    function initDynamicBg() {
        const bg = document.getElementById('dynamic-bg');
        if (!bg) return;
        for (let i = 0; i < 15; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 5 + 2;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${Math.random() * 100}%`;
            p.style.animationDelay = `${Math.random() * 15}s`;
            p.style.animationDuration = `${Math.random() * 10 + 10}s`;
            bg.appendChild(p);
        }
    }

    // Animações de Entrada (Scroll)
    function initScrollAnimations() {
        // Adicionar classe 'reveal' em seções importantes
        const sections = [
            '.countdown-container', 
            '.gallery-section', 
            '.map-section', 
            '.rsvp-section',
            '.btn-calendar'
        ];
        
        sections.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.classList.add('reveal');
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }
});

// Função Global para Download do Calendário (Apple/Outlook)
function downloadICS() {
    const title = "Casamento Ana e Victor";
    const description = "Celebração do casamento de Ana e Victor no Rancho Santa Fé.";
    const location = "Rancho Santa Fé, Campo Largo - PR";
    const start = "20261121T160000"; // 16:00 (ajustar fuso se necessário)
    const end = "20261122T040000";

    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\n");

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'casamento.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
