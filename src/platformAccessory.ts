import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { AqualisaPlatform } from './platform';

export class AqualisaPlatformAccessory {
  private mainService: Service;
  private showerHeadService: Service;
  private bathFillerService: Service;
  private heaterCoolerService: Service;

  private smartValveState = {
    MainValveActive: false,
    MainValveInUse: false,
    ShowerValveSelected: true,
    BathValveSelected: false,
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
      .setCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, 0)
      .setCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, 20)
      .setCharacteristic(this.platform.Characteristic.ValveType, 0); // Generic valve
  
    this.mainService
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setMainValveActive.bind(this))
      .on('get', this.getMainValveActive.bind(this));

    this.mainService
      .getCharacteristic(this.platform.Characteristic.InUse)
      .on('get', this.getMainValveInUse.bind(this));

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

    // Required Characteristics
    this.showerHeadService
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName + ' Valve')
      .setCharacteristic(this.platform.Characteristic.ServiceLabelNamespace, 1)
      .setCharacteristic(this.platform.Characteristic.ServiceLabelIndex, 1)
      .setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.SHOWER_HEAD)
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Shower Head')
      .setCharacteristic(this.platform.Characteristic.Active, 1);
    
    this.showerHeadService
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.invertValves.bind(this))
      .on('get', this.getShowerValve.bind(this));

    this.mainService.addLinkedService(this.showerHeadService);

    // Bath filler
    this.bathFillerService = this.accessory.getService('Bath Filler') || this.accessory.addService(this.platform.Service.Valve, 'Bath Filler', 'Valve-2');
    this.bathFillerService
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName + ' Valve')
      .setCharacteristic(this.platform.Characteristic.ServiceLabelNamespace, 1)
      .setCharacteristic(this.platform.Characteristic.ServiceLabelIndex, 2)
      .setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.WATER_FAUCET)
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Bath Filler')
      .setCharacteristic(this.platform.Characteristic.Active, 0);
    
    this.bathFillerService
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.invertValves.bind(this))
      .on('get', this.getBathValve.bind(this));

    this.mainService.addLinkedService(this.bathFillerService);

  }

  setMainValveActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // Active=0, InUse=0 -> Off
    // Active=1, InUse=0 -> Starting
    // Active=1, InUse=1 -> Running
    // Active=0, InUse=1 -> Stopping

    this.platform.log.debug('Main valve to ', value as boolean);
    // Active updates immediately
    this.mainService.updateCharacteristic(this.platform.Characteristic.Active, value as boolean);
    this.mainService.updateCharacteristic(this.platform.Characteristic.InUse, value as boolean);
    this.smartValveState.MainValveActive = value as boolean;
    this.smartValveState.MainValveInUse = value as boolean;

    callback(null);

  }

  getMainValveInUse(callback: CharacteristicGetCallback) {
    const res = this.smartValveState.MainValveInUse;
    this.platform.log.debug('Get main valve in use ->', res);
    callback(null, res);
  }

  getMainValveActive(callback: CharacteristicGetCallback) {
    const res = this.smartValveState.MainValveActive;
    this.platform.log.debug('Get main valve active ->', res);
    callback(null, res);
  }

  invertValves(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // Invert valves
    this.platform.log.debug('Inverting valves');
    this.showerHeadService.updateCharacteristic(this.platform.Characteristic.Active, this.smartValveState.BathValveSelected);
    this.bathFillerService.updateCharacteristic(this.platform.Characteristic.Active, this.smartValveState.ShowerValveSelected);  
    this.smartValveState.BathValveSelected = !this.smartValveState.BathValveSelected;
    this.smartValveState.ShowerValveSelected = !this.smartValveState.ShowerValveSelected;

    callback(null);
  }

  getShowerValve(callback: CharacteristicGetCallback) {
    const isActive = this.smartValveState.ShowerValveSelected;
    this.platform.log.debug('Get shower valve ->', isActive);
    callback(null, isActive);
  }

  getBathValve(callback: CharacteristicGetCallback) {
    const isActive = this.smartValveState.BathValveSelected;
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

}
