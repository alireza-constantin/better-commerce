import { mutationOptions } from '@tanstack/react-query';
import { adjustInventory, configureInventory } from './inventory-api';
export const configureInventoryMutationOptions = () => mutationOptions({ mutationFn: configureInventory });
export const adjustInventoryMutationOptions = () => mutationOptions({ mutationFn: adjustInventory });
