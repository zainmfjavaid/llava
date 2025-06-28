import { APIClient } from './api-client.js';
import { elements } from './dom-utils.js';

class ExportHandler {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Export button click to toggle dropdown
        const exportBtn = document.getElementById('exportBtn');
        const exportDropdown = document.getElementById('exportDropdown');
        
        if (exportBtn && exportDropdown) {
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!exportBtn.contains(e.target) && !exportDropdown.contains(e.target)) {
                    this.hideDropdown();
                }
            });
        }

        // Export option event listeners
        const exportCopy = document.getElementById('exportCopy');
        const exportPDF = document.getElementById('exportPDF');
        const exportDOCX = document.getElementById('exportDOCX');

        if (exportCopy) {
            exportCopy.addEventListener('click', () => this.handleCopyToClipboard());
        }

        if (exportPDF) {
            exportPDF.addEventListener('click', () => this.handleExportPDF());
        }

        if (exportDOCX) {
            exportDOCX.addEventListener('click', () => this.handleExportDOCX());
        }
    }

    toggleDropdown() {
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        }
    }

    hideDropdown() {
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    showExportButton() {
        const exportWrapper = document.getElementById('exportButtonWrapper');
        const exportSeparator = document.getElementById('exportSeparator');
        if (exportWrapper) {
            exportWrapper.style.display = 'inline-block';
        }
        if (exportSeparator) {
            exportSeparator.style.display = 'inline-block';
        }
    }

    hideExportButton() {
        const exportWrapper = document.getElementById('exportButtonWrapper');
        const exportSeparator = document.getElementById('exportSeparator');
        if (exportWrapper) {
            exportWrapper.style.display = 'none';
        }
        if (exportSeparator) {
            exportSeparator.style.display = 'none';
        }
    }

    async handleCopyToClipboard() {
        try {
            let notesElement = elements.notesInput;
            
            // Fallback: try to find the element by ID if elements.notesInput is null
            if (!notesElement) {
                notesElement = document.getElementById('notesInput');
            }
            
            // Additional fallback: try to find any notes input element
            if (!notesElement) {
                notesElement = document.querySelector('.notes-input') || 
                             document.querySelector('.notes-display') ||
                             document.querySelector('[contenteditable="true"]');
            }
            
            if (!notesElement) {
                console.error('Could not find notes element. Available elements:', {
                    notesInput: elements.notesInput,
                    byId: document.getElementById('notesInput'),
                    byClass: document.querySelector('.notes-input')
                });
                throw new Error('Notes element not found');
            }

            console.log('Found notes element:', notesElement.tagName, notesElement.className);

            // Get the notes content - either innerHTML or textContent depending on the element type
            let notesContent;
            if (notesElement.tagName === 'TEXTAREA') {
                notesContent = notesElement.value;
                console.log('Got textarea content:', notesContent.length, 'characters');
            } else {
                // For contentEditable div, get the text content but preserve some formatting
                notesContent = this.convertHTMLToFormattedText(notesElement.innerHTML);
                console.log('Got div content:', notesContent.length, 'characters');
            }

            if (!notesContent.trim()) {
                throw new Error('No notes to copy');
            }

            // Convert markdown to formatted plain text
            const formattedText = this.convertMarkdownToPlainText(notesContent);

            // Use the Clipboard API
            await navigator.clipboard.writeText(formattedText);
            
            this.showToast('Notes copied to clipboard!', 'success');
            this.hideDropdown();
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showToast('Failed to copy notes', 'error');
        }
    }

    async handleExportPDF() {
        try {
            const noteId = this.getCurrentNoteId();
            if (!noteId) {
                throw new Error('No note ID found');
            }

            this.showLoadingState('Generating PDF...');

            const response = await APIClient.exportNotePDF(noteId);
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Extract filename from response headers
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'notes.pdf';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) {
                    filename = match[1];
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showToast('PDF downloaded successfully!', 'success');
            this.hideDropdown();
            this.hideLoadingState();
        } catch (error) {
            console.error('Failed to export PDF:', error);
            this.showToast('Failed to export PDF', 'error');
            this.hideLoadingState();
        }
    }

    async handleExportDOCX() {
        try {
            const noteId = this.getCurrentNoteId();
            if (!noteId) {
                throw new Error('No note ID found');
            }

            this.showLoadingState('Generating Word document...');

            const response = await APIClient.exportNoteDOCX(noteId);
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Extract filename from response headers
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'notes.docx';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) {
                    filename = match[1];
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showToast('Word document downloaded successfully!', 'success');
            this.hideDropdown();
            this.hideLoadingState();
        } catch (error) {
            console.error('Failed to export DOCX:', error);
            this.showToast('Failed to export Word document', 'error');
            this.hideLoadingState();
        }
    }

    getCurrentNoteId() {
        // Try to get currentNoteId from notes-processor module
        if (window.notesProcessor && window.notesProcessor.currentNoteId) {
            return window.notesProcessor.currentNoteId;
        }
        
        // Fallback: try to get from global variable
        if (window.currentNoteId) {
            return window.currentNoteId;
        }
        
        return null;
    }

    convertHTMLToFormattedText(html) {
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Convert HTML to formatted text
        let text = '';
        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                
                // Add formatting for different HTML elements
                if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
                    text += '\n\n';
                    for (let child of node.childNodes) {
                        walk(child);
                    }
                    text += '\n';
                } else if (tagName === 'p') {
                    text += '\n';
                    for (let child of node.childNodes) {
                        walk(child);
                    }
                    text += '\n';
                } else if (tagName === 'br') {
                    text += '\n';
                } else if (tagName === 'li') {
                    text += '\n• ';
                    for (let child of node.childNodes) {
                        walk(child);
                    }
                } else if (tagName === 'ul' || tagName === 'ol') {
                    text += '\n';
                    for (let child of node.childNodes) {
                        walk(child);
                    }
                    text += '\n';
                } else {
                    for (let child of node.childNodes) {
                        walk(child);
                    }
                }
            }
        };
        
        walk(tempDiv);
        return text.trim();
    }

    convertMarkdownToPlainText(markdown) {
        let text = markdown;
        
        // Remove markdown formatting completely for plain text
        // Convert headers to just the text (no asterisks)
        text = text.replace(/^###\s+(.+)$/gm, '$1');
        text = text.replace(/^##\s+(.+)$/gm, '$1');
        text = text.replace(/^#\s+(.+)$/gm, '$1');
        
        // Remove bold formatting completely
        text = text.replace(/\*\*(.*?)\*\*/g, '$1');
        text = text.replace(/__(.*?)__/g, '$1');
        
        // Remove italic formatting completely
        text = text.replace(/\*(.*?)\*/g, '$1');
        text = text.replace(/_(.*?)_/g, '$1');
        
        // Remove code formatting but keep the text
        text = text.replace(/`([^`]+)`/g, '$1');
        text = text.replace(/```[\s\S]*?```/g, (match) => {
            return match.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        });
        
        // Convert bullet points to simple text with bullets
        text = text.replace(/^[\s]*[-*+]\s+/gm, '• ');
        
        // Clean up extra whitespace
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.trim();
        
        return text;
    }

    showLoadingState(message) {
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = `
                <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                </svg>
                ${message}
            `;
        }
    }

    hideLoadingState() {
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12,19L8,15H10.5V11H13.5V15H16L12,19Z"/>
                </svg>
                Export
            `;
        }
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#667eea'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Export for use in other modules
export { ExportHandler };