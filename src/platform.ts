import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { AqualisaPlatformAccessory } from './platformAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class AqualisaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    // EXAMPLE ONLY
    const exampleDevices = [
      {
        exampleUniqueId: 'BOOB',
        exampleDisplayName: 'Bathroom Aqualisa SmartValve',
      },
    ];
    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of exampleDevices) {
      const uuid = this.api.hap.uuid.generate(device.exampleUniqueId);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        if (device) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          new AqualisaPlatformAccessory(this, existingAccessory);
          this.api.updatePlatformAccessories([existingAccessory]);
        } else if (!device) {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
        }
      } else {
        this.log.info('Adding new accessory:', device.exampleDisplayName);
        const accessory = new this.api.platformAccessory(device.exampleDisplayName, uuid);
        accessory.context.device = device;
        new AqualisaPlatformAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
