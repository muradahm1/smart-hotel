// Reviews page functionality
let selectedRating = 0;

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadReviews();
        setupEventListeners();
        updateCartCount();
    }, 500);
});

function setupEventListeners() {
    document.getElementById('writeReviewBtn').addEventListener('click', showReviewForm);
    document.getElementById('cancelReview').addEventListener('click', hideReviewForm);
    document.getElementById('reviewForm').addEventListener('submit', submitReview);
    
    // Star rating
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.rating);
            document.getElementById('ratingValue').value = selectedRating;
            updateStarDisplay();
        });
    });
}

function updateStarDisplay() {
    document.querySelectorAll('.star').forEach((star, index) => {
        if (index < selectedRating) {
            star.style.color = '#c9b48c';
        } else {
            star.style.color = '#666';
        }
    });
}

function showReviewForm() {
    document.getElementById('reviewFormContainer').style.display = 'block';
    document.getElementById('writeReviewBtn').style.display = 'none';
}

function hideReviewForm() {
    document.getElementById('reviewFormContainer').style.display = 'none';
    document.getElementById('writeReviewBtn').style.display = 'block';
    document.getElementById('reviewForm').reset();
    selectedRating = 0;
    updateStarDisplay();
}

async function loadReviews() {
    if (!supabase) {
        document.getElementById('reviewsGrid').innerHTML = `<div class="empty-state">${translate('reviews_db_connection_failed')}</div>`;
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        renderReviews(data || []);
    } catch (error) {
        console.error('Error loading reviews:', error);
        document.getElementById('reviewsGrid').innerHTML = `<div class="empty-state">${translate('reviews_failed_to_load')}</div>`;
    }
}

function renderReviews(reviews) {
    const reviewsGrid = document.getElementById('reviewsGrid');
    
    if (reviews.length === 0) {
        reviewsGrid.innerHTML = `<div class="empty-state">${translate('reviews_no_reviews_yet')}</div>`;
        return;
    }

    reviewsGrid.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div class="review-info">
                    <h4>${review.customer_name}</h4>
                    <div class="review-rating">
                        ${'⭐'.repeat(review.rating)}
                    </div>
                </div>
                <div class="review-date">
                    ${new Date(review.created_at).toLocaleDateString()}
                </div>
            </div>
            <div class="review-comment">
                ${review.comment || translate('reviews_no_comment')}
            </div>
        </div>
    `).join('');
}

async function submitReview(e) {
    e.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    const rating = parseInt(document.getElementById('ratingValue').value);
    const comment = document.getElementById('comment').value;
    
    if (!customerName || !rating) {
        alert(translate('reviews_alert_fill_name_rating'));
        return;
    }
    
    try {
        const { error } = await supabase
            .from('reviews')
            .insert([{
                customer_name: customerName,
                rating: rating,
                comment: comment
            }]);
            
        if (error) throw error;
        
        alert(translate('reviews_alert_thank_you'));
        hideReviewForm();
        loadReviews();
        
    } catch (error) {
        console.error('Error submitting review:', error);
        alert(translate('reviews_alert_submit_failed'));
    }
}

// Utility functions
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('restaurant_cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElements = document.querySelectorAll('.cart-count');
    
    cartCountElements.forEach(element => {
        element.textContent = totalItems;
    });
}