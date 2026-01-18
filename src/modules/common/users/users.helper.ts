import { Role } from 'src/common/enums/role.enum';
import { User } from './entities/user.entity';
import { redactField } from 'src/common/utils/redact.util';

export function formatUser(user: Omit<User, 'password'>, currentRole: Role) {
  return {
    id: user.id,
    name: user.name,
    email: redactField({
      value: user.email,
      currentRole,
      targetRole: user.role,
    }),
    phone: redactField({
      value: user.phone,
      currentRole,
      targetRole: user.role,
    }),
    image: user.image,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
