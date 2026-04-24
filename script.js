document.addEventListener('DOMContentLoaded', () => {
    const envelope = document.getElementById('envelope');
    const openBtn = document.getElementById('open-btn');
    const invitationContent = document.getElementById('invitation-content');
    const rsvpForm = document.getElementById('rsvp-form');
    const addCompanionBtn = document.getElementById('add-companion');
    const companionsContainer = document.getElementById('companions-container');

    // Supabase Configuration
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
        
        // Wait for animation to finish before showing content
        setTimeout(() => {
            document.body.classList.add('opened');
            envelope.style.display = 'none';
            invitationContent.style.display = 'block';
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }, 1000);
    });

    // 2. Add Companion Logic
    addCompanionBtn.addEventListener('click', () => {
        const companionId = Date.now();
        const companionDiv = document.createElement('div');
        companionDiv.className = 'companion-item';
        companionDiv.id = `companion-${companionId}`;
        
        companionDiv.innerHTML = `
            <input type="text" placeholder="Nome do acompanhante" class="companion-input" required>
            <button type="button" class="remove-companion" title="Remover">×</button>
        `;
        
        companionsContainer.appendChild(companionDiv);

        // Remove companion event
        companionDiv.querySelector('.remove-companion').addEventListener('click', () => {
            companionDiv.remove();
        });
    });

    // 3. Form Submission
    rsvpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = rsvpForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        const guestName = document.getElementById('guest-name').value;
        const companionInputs = document.querySelectorAll('.companion-input');
        const companions = Array.from(companionInputs).map(input => input.value);

        const rsvpData = {
            name: guestName,
            companions: companions
        };

        // Save to Supabase
        const { error } = await _supabase
            .from('rsvps')
            .insert([rsvpData]);

        if (error) {
            console.error('Error saving to Supabase:', error);
            alert('Erro ao confirmar presença. Por favor, tente novamente.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar Presença';
            return;
        }

        // Mark as confirmed for this device
        localStorage.setItem('rsvp_confirmed', 'true');

        alert('Presença confirmada com sucesso! Você será redirecionado para a lista de presentes.');
        
        // 4. Redirect to Gift List
        window.location.href = GIFT_LIST_URL;
    });

    function renderRSVPStatus() {
        if (localStorage.getItem('rsvp_confirmed')) {
            const rsvpSection = document.querySelector('.rsvp-section');
            if (rsvpSection) {
                rsvpSection.innerHTML = `
                    <div style="text-align: center; padding: 20px; background: #f9f9f9; border-radius: 12px; border: 1px solid var(--primary);">
                        <h3 style="color: var(--primary); margin-bottom: 10px;">Presença já Confirmada!</h3>
                        <p>Obrigado por confirmar sua presença. Mal podemos esperar para celebrar com você!</p>
                        <a href="${GIFT_LIST_URL}" class="btn" style="display: inline-block; margin-top: 20px; text-decoration: none;">Ver Lista de Presentes</a>
                    </div>
                `;
            }
        }
    }

    // Call this to handle initial state
    renderRSVPStatus();
});
