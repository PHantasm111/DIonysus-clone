import { db } from '@/server/db';
import { auth, clerkClient, EmailAddress } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation';

const SyncUser = async () => {

    // 通过auth中间件拿到当前用户的id
    const { userId } = await auth();

    // 如果用户不存在直接抛出错误
    if (!userId) {
        throw new Error('User not found')
    }

    // 通过clerkClient拿到Clerk的client对象
    const client = await clerkClient();

    // 通过client对象拿到当前用户的信息
    const user = await client.users.getUser(userId);

    if (!user.emailAddresses[0]?.emailAddress) {
        return notFound();
    }

    await db.user.upsert({
        where: {
            emailAddress: user.emailAddresses[0]?.emailAddress ?? ""
        },
        update: {
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName,
        },
        create:{
            id: userId,
            emailAddress: user.emailAddresses[0]?.emailAddress ?? "",
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName,
        }
    })

    return redirect('/dashboard')
}

export default SyncUser