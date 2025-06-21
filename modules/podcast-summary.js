import { authenticatedFetch } from './auth-manager.js';
import { showError } from './auth-ui.js';
import { processGeneratedNotes } from './markdown-processor.js';

const API_BASE_URL = 'http://localhost:8000/v1'; // Assuming local dev

export async function generatePodcastSummary() {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/podcast-summary`, {
            method: 'GET'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate podcast summary');
        }

        const data = await response.json();
        
        // Create or get the podcast summary container
        let summaryContainer = document.getElementById('podcast-summary-container');
        if (!summaryContainer) {
            summaryContainer = document.createElement('div');
            summaryContainer.id = 'podcast-summary-container';
            const mainContent = document.querySelector('.home-content') || document.querySelector('.main-content');
            mainContent.appendChild(summaryContainer);
        }

        // Clear previous content
        summaryContainer.innerHTML = '';

        // Add metadata
        const metadata = document.createElement('div');
        metadata.className = 'podcast-summary-metadata';
        metadata.innerHTML = `
            <p>Generated at: ${new Date(data.generated_at).toLocaleString()}</p>
            <p>Meetings included: ${data.meeting_count}</p>
        `;
        summaryContainer.appendChild(metadata);

        // Add the summary content
        const content = document.createElement('div');
        content.className = 'podcast-summary-content';
        content.innerHTML = processGeneratedNotes(data.podcast_summary);
        summaryContainer.appendChild(content);

        // Scroll to the summary
        summaryContainer.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        showError('Failed to generate podcast summary: ' + error.message);
    }
} 