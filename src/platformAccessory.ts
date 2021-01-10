import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { AqualisaPlatform } from './platform';

export class AqualisaPlatformAccessory {
  private mainService: Service;
  private showerHeadService: Service;
  private bathFillerService: Service;
  private heaterCoolerService: Service;

  private smartValveState = {
    MainValveRunning: false,
    ShowerValveRunning: false,
    BathValveRunning: false,
    Temperature: 20,
    HeatCool: 0,
  };

  constructor(
    private readonly platform: AqualisaPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Set root accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Aqualisa')
      .setCharacteristic(this.platform.Characteristic.Model, 'Quartz Touch')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.exampleUniqueId);

    // Create the main faucet service
    this.mainService = this.accessory.getService(this.platform.Service.Faucet) || this.accessory.addService(this.platform.Service.Faucet);

    // Add Heater/Cooler Service for Temperature Adjustment to main service
    this.heaterCoolerService = this.accessory.getService('Heater') || this.accessory.addService(this.platform.Service.HeaterCooler, 'Heater', 'Heater');
    this.mainService.addLinkedService(this.heaterCoolerService);

    this.mainService
      .setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName)
      .setCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, 0)
      .setCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, 20)
      .setCharacteristic(this.platform.Characteristic.Active, 0)
      .setCharacteristic(this.platform.Characteristic.InUse, 0);

    this.mainService
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setMainValveRunning.bind(this))
      .on('get', this.getMainValveRunning.bind(this));

    this.mainService
      .getCharacteristic(this.platform.Characteristic.InUse)
      .on('set', this.setMainValveRunning.bind(this))
      .on('get', this.getMainValveRunning.bind(this));

    this.mainService
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .on('set', this.setHeatCoolState.bind(this))
      .on('get', this.getHeatCoolState.bind(this))
      .updateValue(this.smartValveState.HeatCool);

    this.mainService
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .on('set', this.setMainTemp.bind(this))
      .on('get', this.getMainTemp.bind(this))
      .setProps({ maxValue: 45, minValue: 15, minStep: 1 })
      .updateValue(this.smartValveState.Temperature);

    // Add child valves

    // Shower head
    this.showerHeadService = this.accessory.getService('Shower Head') || this.accessory.addService(this.platform.Service.Valve, 'Shower Head', 'Valve-1'); 
    this.mainService.addLinkedService(this.showerHeadService);

    // Required Characteristics
    this.showerHeadService
      .setCharacteristic(this.platform.Characteristic.Active, 0)
      .setCharacteristic(this.platform.Characteristic.InUse, 0)
      .setCharacteristic(this.platform.Characteristic.ServiceLabelIndex, 1)
      .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
      .setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.SHOWER_HEAD)
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Shower Head');
    
    this.showerHeadService
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setShowerValve.bind(this))
      .on('get', this.getShowerValve.bind(this));

    // Bath filler
    this.bathFillerService = this.accessory.getService('Bath Filler') || this.accessory.addService(this.platform.Service.Valve, 'Bath Filler', 'Valve-2');
    this.mainService.addLinkedService(this.bathFillerService);

    this.bathFillerService
      .setCharacteristic(this.platform.Characteristic.Active, 0)
      .setCharacteristic(this.platform.Characteristic.InUse, 0)
      .setCharacteristic(this.platform.Characteristic.ServiceLabelIndex, 2)
      .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
      .setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.WATER_FAUCET)
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Bath Filler');
    
    this.bathFillerService
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setBathValve.bind(this))
      .on('get', this.getBathValve.bind(this));

  }

  setMainValveRunning(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.smartValveState.MainValveRunning = value as boolean;
    this.platform.log.debug('Main valve to ', value);

    if (value === 0) {
      // deactivate both valves
      this.platform.log.debug('Turning both child valves off');
      this.smartValveState.ShowerValveRunning = false as boolean;
      this.smartValveState.BathValveRunning = false as boolean;
      this.showerHeadService.updateCharacteristic(this.platform.Characteristic.InUse, false);
      this.showerHeadService.updateCharacteristic(this.platform.Characteristic.Active, false);
      this.bathFillerService.updateCharacteristic(this.platform.Characteristic.InUse, false);
      this.bathFillerService.updateCharacteristic(this.platform.Characteristic.Active, false);
    } else {
      if (!this.smartValveState.BathValveRunning && !this.smartValveState.ShowerValveRunning) {
        // shower by default
        this.platform.log.debug('Both valves were off, activating shower');
        // logic bodge
        this.smartValveState.BathValveRunning = true;
        this.setShowerValve(1, () => 0);
      }
    }

    // Active=0, InUse=0 -> Off
    // Active=1, InUse=0 -> Starting
    // Active=1, InUse=1 -> Running
    // Active=0, InUse=1 -> Stopping
  
    // Active updates immediately
    this.platform.log.debug('Active to ', value);
    this.mainService.updateCharacteristic(this.platform.Characteristic.Active, value);  
    // InUse indicates it's actually running, so wait on API
    this.doAPIThing().then(() => {
      this.platform.log.debug('InUse to ', value);
      this.mainService.updateCharacteristic(this.platform.Characteristic.InUse, value);
      callback(null);
    });

  }

  getMainValveRunning(callback: CharacteristicGetCallback) {
    const isActive = this.smartValveState.MainValveRunning;
    this.platform.log.debug('Get main valve ->', isActive);
    callback(null, isActive);
  }

  setShowerValve(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // Figure out intent

    if (value as boolean && this.smartValveState.BathValveRunning as boolean) {
      // Bath is currently running, but they want shower. Switch valve selection to Shower.
      this.platform.log.debug('Switching from Bath to Shower');
      this.smartValveState.BathValveRunning = false as boolean;
      this.smartValveState.ShowerValveRunning = true as boolean;
      this.showerHeadService.updateCharacteristic(this.platform.Characteristic.Active, true as boolean);
      this.bathFillerService.updateCharacteristic(this.platform.Characteristic.Active, false as boolean);  
    } else if (!value as boolean && this.smartValveState.ShowerValveRunning) {
      // Shower is currently running. Turn it off along with the main valve.
      this.platform.log.debug('Switching off shower and main valve');
      this.smartValveState.ShowerValveRunning = false as boolean;
      this.showerHeadService.updateCharacteristic(this.platform.Characteristic.Active, false as boolean);
      this.setMainValveRunning(0, () => 0);
    } else if (value as boolean && !this.smartValveState.MainValveRunning as boolean) {
      // Shower to be switched on, but main valve is off
      this.platform.log.debug('Switching on shower and main valve');
      this.smartValveState.ShowerValveRunning = true as boolean;
      this.showerHeadService.updateCharacteristic(this.platform.Characteristic.Active, true as boolean);
      this.setMainValveRunning(1, () => 0);
    } else if (!value as boolean && this.smartValveState.MainValveRunning as boolean) {
      // Bath to be switched off, but main valve is on
      this.platform.log.debug('Switching off shower and main valve');
      this.setMainValveRunning(0, () => 0);
    }

    callback(null);
  }

  getShowerValve(callback: CharacteristicGetCallback) {
    const isActive = this.smartValveState.ShowerValveRunning;
    this.platform.log.debug('Get shower valve ->', isActive);
    callback(null, isActive);
  }

  setBathValve(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.platform.log.debug('Set Bath Valve Called', value);

    // Figure out intent
    if (value as boolean && this.smartValveState.ShowerValveRunning as boolean) {
      // Shower is currently running, but they want bath. Switch valve selection to Shower.
      this.platform.log.debug('Switching from Shower to Bath');
      this.smartValveState.BathValveRunning = true as boolean;
      this.smartValveState.ShowerValveRunning = false as boolean;
      this.showerHeadService.updateCharacteristic(this.platform.Characteristic.Active, !value);
      this.bathFillerService.updateCharacteristic(this.platform.Characteristic.Active, value);  
    } else if (!value as boolean && this.smartValveState.BathValveRunning) {
      // Bath is currently running. Turn it off along with the main valve.
      this.platform.log.debug('Switching off bath and main valve');
      this.smartValveState.BathValveRunning = false as boolean;
      this.bathFillerService.updateCharacteristic(this.platform.Characteristic.Active, false as boolean);
      this.setMainValveRunning(0, () => 0);
    } else if (value as boolean && !this.smartValveState.MainValveRunning as boolean) {
      // Bath to be switched on, but main valve is off
      this.platform.log.debug('Switching on bath and main valve');
      this.smartValveState.BathValveRunning = true as boolean;
      this.bathFillerService.updateCharacteristic(this.platform.Characteristic.Active, true as boolean);
      this.setMainValveRunning(1, () => 0);
    } else if (!value as boolean && this.smartValveState.MainValveRunning as boolean) {
      // Bath to be switched off, but main valve is on
      this.platform.log.debug('Switching off bath and main valve');
      this.setMainValveRunning(0, () => 0);
    }

    callback(null);
    
  }

  getBathValve(callback: CharacteristicGetCallback) {
    const isActive = this.smartValveState.BathValveRunning;
    this.platform.log.debug('Get bath valve ->', isActive);
    callback(null, isActive);
  }

  setMainTemp(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.smartValveState.Temperature = value as number;
    this.platform.log.debug('Set temperature to', value);
    this.mainService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, value);
    callback();
  }

  getMainTemp(callback: CharacteristicSetCallback) {
    const temp = this.smartValveState.Temperature;
    this.platform.log.debug('Get temperature, it\'s ', temp);
    callback(null, temp);
  }

  // Heat/Cool state is always 0 (Auto) so these are really just placeholders
  setHeatCoolState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.smartValveState.HeatCool = value as number;
    this.mainService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, value);
    callback();
  }

  getHeatCoolState(callback: CharacteristicSetCallback) {
    const hc = this.smartValveState.HeatCool as number;
    callback(null, hc);
  }

  doAPIThing() {
    return this.delay(2000).then((() => {
      return true;
    }));
  }

  delay(t) {
    return new Promise((resolve) => { 
      setTimeout(resolve.bind(null), t);
    });
  }

}
