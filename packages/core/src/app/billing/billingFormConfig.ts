import { type Address, type FormField, type LanguageService } from '@bigcommerce/checkout-sdk';
import { lazy } from 'yup';

interface AddressWithEmail extends Address {
    email?: string;
}

export interface BillingFormValues extends AddressFormValues {
    orderComment: string;
    email?: string;
}

import {
    type AddressFormValues,
    getAddressFormFieldsValidationSchema,
    getTranslateAddressError,
    mapAddressToFormValues,
} from '../address';
import {
    getAddressExtraFieldsValidationSchema,
    getCustomFormFieldsValidationSchema,
} from '../formFields';

export const getBillingFormInitialValues = (
    getFields: (countryCode?: string) => FormField[],
    billingAddress: Address | undefined,
    customerMessage: string,
): BillingFormValues => ({
    ...mapAddressToFormValues(
        getFields(billingAddress && billingAddress.countryCode),
        billingAddress,
    ),
    orderComment: customerMessage,
    email: (billingAddress as AddressWithEmail | undefined)?.email || '',
});

export const getBillingFormValidationSchema = (
    language: LanguageService,
    getFields: (countryCode?: string) => FormField[],
    methodId?: string,
) =>
    methodId === 'amazonpay'
        ? lazy<Partial<AddressFormValues>>((values) => {
              const translate = getTranslateAddressError(
                  getFields(values && values.countryCode),
                  language,
              );

              return getCustomFormFieldsValidationSchema({
                  translate,
                  formFields: getFields(values && values.countryCode),
              }).concat(
                  getAddressExtraFieldsValidationSchema({
                      translate,
                      formFields: getFields(values && values.countryCode),
                  }),
              );
          })
        : lazy<Partial<AddressFormValues>>((values) =>
              getAddressFormFieldsValidationSchema({
                  language,
                  formFields: getFields(values && values.countryCode),
              }),
          );
