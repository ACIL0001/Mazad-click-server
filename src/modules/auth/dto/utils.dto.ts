import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  isEmail,
  isPhoneNumber,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsEmailOrPhoneNumber', async: false })
export class IsEmailOrPhoneNumber implements ValidatorConstraintInterface {
  validate(value: any): Promise<boolean> | boolean {
    const _isEmail = isEmail(value);
    const _isPhoneNumber = isPhoneNumber(value, 'DZ');

    return _isEmail || _isPhoneNumber;
  }

  defaultMessage(): string {
    return 'login must be a valid email address or a phone number';
  }
}
