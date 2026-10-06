export const serviceInspectionFormats={
 container:'{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Image}},"ConfigImage":{{json .Config.Image}},"Labels":{{json .Config.Labels}},"Mounts":{{json .Mounts}},"PortBindings":{{json .HostConfig.PortBindings}},"Privileged":{{json .HostConfig.Privileged}},"NetworkMode":{{json .HostConfig.NetworkMode}},"Networks":{{json .NetworkSettings.Networks}},"Running":{{json .State.Running}},"Health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}""{{end}}}',
 volume:'{"Name":{{json .Name}},"Driver":{{json .Driver}},"Scope":{{json .Scope}},"Labels":{{json .Labels}},"Options":{{json .Options}},"CreatedAt":{{json .CreatedAt}}}',
 network:'{"Id":{{json .Id}},"Name":{{json .Name}},"Driver":{{json .Driver}},"Labels":{{json .Labels}},"Internal":{{json .Internal}},"Attachable":{{json .Attachable}},"EnableIPv6":{{json .EnableIPv6}},"Options":{{json .Options}}}',
};
