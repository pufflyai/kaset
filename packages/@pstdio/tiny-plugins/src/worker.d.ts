declare module "*?worker&inline" {
  const WorkerFactory: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerFactory;
}
