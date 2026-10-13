#ifndef CL_ROOT_FORMATS_H
#define CL_ROOT_FORMATS_H
/* Fixed publisher-owned formats, never wire input. */
static const char root_container_format[]="{\"Id\":{{json .Id}},\"Name\":{{json .Name}},\"Image\":{{json .Image}},\"ConfigImage\":{{json .Config.Image}},\"Labels\":{{json .Config.Labels}},\"Mounts\":{{json .Mounts}},\"PortBindings\":{{json .HostConfig.PortBindings}},\"Privileged\":{{json .HostConfig.Privileged}},\"NetworkMode\":{{json .HostConfig.NetworkMode}},\"Networks\":{{json .NetworkSettings.Networks}},\"Running\":{{json .State.Running}},\"Health\":{{if index .State \"Health\"}}{{json (index .State \"Health\").Status}}{{else}}\"\"{{end}}}";
static const char root_volume_format[]="{\"Name\":{{json .Name}},\"Driver\":{{json .Driver}},\"Scope\":{{json .Scope}},\"Labels\":{{json .Labels}},\"Options\":{{json .Options}},\"CreatedAt\":{{json .CreatedAt}}}";
static const char root_network_format[]="{\"Id\":{{json .Id}},\"Name\":{{json .Name}},\"Driver\":{{json .Driver}},\"Labels\":{{json .Labels}},\"Internal\":{{json .Internal}},\"Attachable\":{{json .Attachable}},\"EnableIPv6\":{{json .EnableIPv6}},\"Options\":{{json .Options}}}";
static const char root_image_format[]="{\"Id\":{{json .Id}},\"Os\":{{json .Os}},\"Architecture\":{{json .Architecture}},\"Variant\":{{if index . \"Variant\"}}{{json (index . \"Variant\")}}{{else}}\"\"{{end}},\"RepoDigests\":{{json .RepoDigests}},\"Volumes\":{{json (index .Config \"Volumes\")}}}";
#endif
