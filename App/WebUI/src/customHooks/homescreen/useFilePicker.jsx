import { useState, useRef } from 'react';

export function useFilePicker() {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    // Web has no imperative "open file dialog" API on its own - it has
    // to be triggered by a click on a real <input type="file">. This
    // hook now creates one lazily and clicks it programmatically, so
    // the calling component can still just call pickFiles() the same
    // way it did before, without needing to render the input itself.
    function pickFiles() {
        if (!inputRef.current) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.xlsx,.xls';
            input.multiple = true;
            input.style.display = 'none';
            input.addEventListener('change', handleFilesChosen);
            document.body.appendChild(input);
            inputRef.current = input;
        }
        // Reset value first so choosing the same file(s) again still
        // fires 'change' - browsers don't fire it if the selection is
        // identical to last time otherwise.
        inputRef.current.value = '';
        inputRef.current.click();
    }

    function handleFilesChosen(e) {
        const files = Array.from(e.target.files || []);

        const validFiles = files.filter(f => {
            const name = f.name.toLowerCase();
            return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
        });

        if (validFiles.length === 0) {
            setStatus(null);
            setError('Please choose at least one .csv, .xlsx, or .xls file');
            return;
        }

        setSelectedFiles(validFiles);
        setError(null);
        setStatus(`${validFiles.length} file(s) selected`);
    }

    return {
        pickFiles,
        selectedFiles,
        setSelectedFiles,
        status,
        setStatus,
        error,
        setError,
    };
}