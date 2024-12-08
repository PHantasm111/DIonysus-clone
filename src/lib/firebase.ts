// Import the functions you need from the SDKs you need
import { rejects } from "assert";
import { initializeApp } from "firebase/app";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { Download } from "lucide-react";
import { resolve } from "path";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCDawbN3TzOuUEWPiD2cBIwDSxQqC26v5o",
    authDomain: "dionysus-ph.firebaseapp.com",
    projectId: "dionysus-ph",
    storageBucket: "dionysus-ph.firebasestorage.app",
    messagingSenderId: "685712026525",
    appId: "1:685712026525:web:b14f88ecf650a753cc5d74"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);

export async function uploadFile(file: File, setProgress?: (progress: number) => void) {
    return new Promise((resolve, reject) => {
        try {

            const storageRef = ref(storage, file.name);
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on("state_changed", (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (setProgress) {
                    setProgress(progress);
                    switch (snapshot.state) {
                        case "paused":
                            console.log("Upload is paused");
                            break;
                        case "running":
                            console.log("Upload is running");
                            break;
                    }
                }
            }, (error) => {
                reject(error)
            }, () => {
                getDownloadURL(uploadTask.snapshot.ref).then(DownloadUrl => {
                    resolve(DownloadUrl as string)
                })
            })

        } catch (error) {
            console.log(error);
            reject(error)
        }
    })
}