'use client'

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { uploadFile } from '@/lib/firebase';
import { Presentation, Upload } from 'lucide-react';
import React from 'react'
import { useDropzone } from 'react-dropzone';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { api } from '@/trpc/react';
import useProject from '@/hooks/use-project';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const MeetingCard = () => {
    const { project } = useProject();

    const processingMeeting = useMutation({
        mutationFn: async (data: { meetingUrl: string, meetingId: string, projectId: string }) => {
            const { meetingUrl, meetingId, projectId } = data
            const response = await axios.post('/api/processing-meeting', { meetingUrl, meetingId, projectId });
            return response.data;
        }
    })

    const [isUploading, setUploading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const router = useRouter();
    const uploadingMeeting = api.project.uploadMeeting.useMutation();

    const { getRootProps, getInputProps } = useDropzone({
        accept: {
            'audio/*': ['.mp3', '.wav', '.m4a']
        },
        multiple: false,
        maxSize: 50_000_000,
        onDrop: async acceptedFiles => {
            if (!project) return;
            setUploading(true);

            const file = acceptedFiles[0];
            if (!file) return;

            const downloadURL = await uploadFile(file as File, setProgress) as string;
            uploadingMeeting.mutate({
                projectId: project.id,
                meetingUrl: downloadURL,
                name: file?.name,
            }, {
                onSuccess: (meeting) => {
                    toast.success('Meeting uploaded successfully')
                    router.push('/meetings')
                    processingMeeting.mutateAsync({ meetingUrl: downloadURL, meetingId: meeting.id, projectId: project.id })
                },
                onError: () => {
                    toast.error('Meeting upload failed')
                }
            })
            window.alert(downloadURL)
            setUploading(false);

        }
    })


    return (
        <Card className='col-span-2 flex flex-col items-center justify-center p-10' {...getRootProps()}>
            {!isUploading && (
                <>
                    <Presentation className='h-10 w-10 animate-bounce' />
                    <h3 className='mt-2 text-sm font-semibold text-gray-900'>
                        Create a new meeting
                    </h3>
                    <p className='mt-1 text-center text-sm text-gray-500'>
                        Analyse your meeting with Dionysus.
                        <br />
                        Powered by AI.
                    </p>
                    <div className='mt-8'>
                        <Button disabled={isUploading}>
                            <Upload className='-ml-0.5 mr-1.5 h-5 w-5' aria-hidden="true" />
                            Uploade Meeting
                            <input className='hidden' {...getInputProps()} />
                        </Button>
                    </div>
                </>
            )}
            {isUploading && (
                <div>
                    <CircularProgressbar value={progress} text={`${progress}%`} className='size-20' styles={
                        buildStyles({
                            pathColor: '#2563eb',
                            textColor: '#2563eb',
                        })
                    } />
                    <p className='text-sm text-gray-500 text-center'>Uploading your meeting...</p>
                </div>
            )}

        </Card>
    )
}

export default MeetingCard