import axios from 'axios';
import FormData from 'form-data';

class IPFSService {
    private pinataApiKey = process.env.PINATA_API_KEY!;
    private pinataSecretKey = process.env.PINATA_SECRET_KEY!;
    
    async uploadFile(fileBuffer: Buffer, filename: string): Promise<string> {
        try {
            const formData = new FormData();
            formData.append('file', fileBuffer, filename);
            
            const response = await axios.post(
                'https://api.pinata.cloud/pinning/pinFileToIPFS',
                formData,
                {
                    headers: {
                        'Content-Type': `multipart/form-data;`,
                        'pinata_api_key': this.pinataApiKey,
                        'pinata_secret_api_key': this.pinataSecretKey
                    }
                }
            );
            
            const ipfsHash = response.data.IpfsHash;
            return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
            
        } catch (error) {
            console.error('IPFS upload error:', error);
            throw new Error('Failed to upload to IPFS');
        }
    }
    
    async uploadJSON(jsonData: object): Promise<string> {
        try {
            const response = await axios.post(
                'https://api.pinata.cloud/pinning/pinJSONToIPFS',
                jsonData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'pinata_api_key': this.pinataApiKey,
                        'pinata_secret_api_key': this.pinataSecretKey
                    }
                }
            );
            
            const ipfsHash = response.data.IpfsHash;
            return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
            
        } catch (error) {
            console.error('IPFS JSON upload error:', error);
            throw new Error('Failed to upload JSON to IPFS');
        }
    }
}

export default new IPFSService();

