import * as bcrypt from 'bcryptjs';


export class PasswordUtil {

    static async hash(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(10)
        return bcrypt.hash(password, salt);
    }

    static async compare(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }
}