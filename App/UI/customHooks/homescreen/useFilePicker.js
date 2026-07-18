import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';

export function useFilePicker(){
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    async function pickFiles() {
        const result = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
            multiple: true,
        });

        if (result.canceled) {
            return;
        }

        const csvFiles = result.assets.filter(f =>
            f.name.toLowerCase().endsWith('.csv')
        );

        if (csvFiles.length === 0) {
            setStatus(null);
            setError('Please choose at least one .csv file');
            return;
        }

        setSelectedFiles(csvFiles);
        setError(null);
        setStatus(`${csvFiles.length} file(s) selected`);
    }

    return {
        pickFiles,
        selectedFiles,
        setSelectedFiles,
        status,
        setStatus,
        error,
        setError,
    }
}