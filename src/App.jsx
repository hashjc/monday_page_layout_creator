import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import "@vibe/core/tokens";
import { Heading, Text, Loader, Box, Flex, TextField, IconButton, Button } from "@vibe/core";
import { Settings, CloseSmall, Add } from "@vibe/icons";

const monday = mondaySdk();

const App = () => {
    console.log("App start");
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const [context, setContext] = useState();
    const [boardId, setBoardId] = useState(null);
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hoveredColumnId, setHoveredColumnId] = useState(null);
    const [childBoards, setChildBoards] = useState([]);
    const [loadingChildBoards, setLoadingChildBoards] = useState(false);
    const [hoveredChildBoardId, setHoveredChildBoardId] = useState(null);
    const [selectedSection, setSelectedSection] = useState("columns");
    const [searchColumnsQuery, setSearchColumnsQuery] = useState("");
    const [searchChildBoardsQuery, setSearchChildBoardsQuery] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [boardName, setBoardName] = useState("Board");
    const [instanceId, setInstanceId] = useState(null);

    // Layout sections with fields
    const [layoutSections, setLayoutSections] = useState([]);
    const [savedLayoutSections, setSavedLayoutSections] = useState([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [hoveredFieldId, setHoveredFieldId] = useState(null);
    const [savingLayout, setSavingLayout] = useState(false);

    // New section dialog
    const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");

    // Drag state
    const [draggedColumn, setDraggedColumn] = useState(null);
    const [dragOverSectionId, setDragOverSectionId] = useState(null);

    // ============================================
    // FETCH CHILD BOARDS
    // ============================================
    const fetchChildBoards = async (currentBoardId) => {
        setLoadingChildBoards(true);
        try {
            const boardsQuery = `
            query {
              boards(limit: 500) {
                id
                name
                columns {
                  id
                  title
                  type
                  settings_str
                }
              }
            }
          `;

            const boardsResult = await monday.api(boardsQuery);
            const allBoards = boardsResult.data?.boards || [];
            const childBoardsList = [];

            for (const board of allBoards) {
                if (board.id === currentBoardId) continue;
                for (const column of board.columns || []) {
                    if (column.type === "board_relation") {
                        try {
                            const settings = JSON.parse(column.settings_str || "{}");
                            if (settings.boardIds && settings.boardIds.includes(parseInt(currentBoardId))) {
                                childBoardsList.push({
                                    id: `${board.id}-${column.id}`,
                                    boardId: board.id,
                                    boardName: board.name,
                                    columnId: column.id,
                                    columnLabel: column.title,
                                    label: `${board.name} - ${column.title}`,
                                });
                            }
                        } catch (e) {
                            console.warn("Could not parse column settings:", e);
                        }
                    }
                }
            }

            childBoardsList.sort((a, b) => a.label.localeCompare(b.label));
            setChildBoards(childBoardsList);
        } catch (error) {
            console.error("Error fetching child boards:", error);
        } finally {
            setLoadingChildBoards(false);
        }
    };

    // ============================================
    // LOAD SAVED LAYOUT
    // ============================================
    const loadSavedLayout = async (instance) => {
        try {
            const storageKey = `layout_sections_${instance}`;
            const result = await monday.storage.instance.getItem(storageKey);

            if (result?.data?.value) {
                const savedSections = JSON.parse(result.data.value);
                console.log("Loaded saved sections:", savedSections);
                setLayoutSections(savedSections);
                setSavedLayoutSections(savedSections);
            } else {
                // Default: one section with Item Name only
                const defaultSections = [
                    {
                        id: "default",
                        title: `${boardName} Information`,
                        isDefault: true,
                        fields: [
                            {
                                id: "name",
                                columnId: "name",
                                label: "Item Name",
                                type: "text",
                                isDefault: true,
                            },
                        ],
                    },
                ];
                setLayoutSections(defaultSections);
                setSavedLayoutSections(defaultSections);
            }
        } catch (error) {
            console.error("Error loading layout:", error);
            const defaultSections = [
                {
                    id: "default",
                    title: `${boardName} Information`,
                    isDefault: true,
                    fields: [
                        {
                            id: "name",
                            columnId: "name",
                            label: "Item Name",
                            type: "text",
                            isDefault: true,
                        },
                    ],
                },
            ];
            setLayoutSections(defaultSections);
            setSavedLayoutSections(defaultSections);
        }
    };

    // ============================================
    // SAVE LAYOUT
    // ============================================
    const saveLayout = async () => {
        setSavingLayout(true);
        try {
            const storageKey = `layout_sections_${instanceId}`;
            await monday.storage.instance.setItem(storageKey, JSON.stringify(layoutSections));

            setSavedLayoutSections(JSON.parse(JSON.stringify(layoutSections)));
            setHasUnsavedChanges(false);

            monday.execute("notice", {
                message: "Layout saved successfully!",
                type: "success",
                timeout: 3000,
            });

            console.log("Layout saved:", layoutSections);
        } catch (error) {
            console.error("Error saving layout:", error);
            monday.execute("notice", {
                message: "Error saving layout",
                type: "error",
                timeout: 3000,
            });
        } finally {
            setSavingLayout(false);
        }
    };

    // ============================================
    // CANCEL CHANGES
    // ============================================
    const cancelLayoutChanges = () => {
        setLayoutSections(JSON.parse(JSON.stringify(savedLayoutSections)));
        setHasUnsavedChanges(false);

        monday.execute("notice", {
            message: "Changes cancelled",
            type: "info",
            timeout: 2000,
        });
    };

    // ============================================
    // CREATE NEW SECTION
    // ============================================
    const createNewSection = () => {
        if (!newSectionName.trim()) {
            monday.execute("notice", {
                message: "Section name is required",
                type: "error",
                timeout: 2000,
            });
            return;
        }

        const newSection = {
            id: `section_${Date.now()}`,
            title: newSectionName.trim(),
            isDefault: false,
            fields: [],
        };

        setLayoutSections([...layoutSections, newSection]);
        setShowNewSectionDialog(false);
        setNewSectionName("");

        monday.execute("notice", {
            message: `Section "${newSectionName}" created`,
            type: "success",
            timeout: 2000,
        });
    };

    // ============================================
    // DELETE SECTION
    // ============================================
    const deleteSection = (sectionId) => {
        const section = layoutSections.find((s) => s.id === sectionId);

        if (section?.isDefault) {
            monday.execute("notice", {
                message: "Default section cannot be deleted",
                type: "error",
                timeout: 2000,
            });
            return;
        }

        if (!window.confirm(`Delete section "${section.title}"?`)) {
            return;
        }

        setLayoutSections(layoutSections.filter((s) => s.id !== sectionId));
    };

    // ============================================
    // DRAG AND DROP HANDLERS
    // ============================================
    const handleColumnDragStart = (e, column) => {
        console.log("Drag started:", column.title);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", column.id); // Required for Firefox
        setDraggedColumn(column);
    };

    const handleSectionDragOver = (e, sectionId) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setDragOverSectionId(sectionId);
    };

    const handleSectionDragLeave = (e, sectionId) => {
        // Only clear if we're actually leaving this section's drop zone
        const rect = e.currentTarget.getBoundingClientRect();
        const isInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

        if (!isInside) {
            setDragOverSectionId(null);
        }
    };

    const handleSectionDrop = (e, sectionId) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Drop on section:", sectionId, "Column:", draggedColumn);

        setDragOverSectionId(null);

        if (!draggedColumn) {
            console.log("No dragged column");
            return;
        }

        // Check if column already exists in ANY section
        const exists = layoutSections.some((section) => section.fields.some((field) => field.columnId === draggedColumn.id));

        if (exists) {
            monday.execute("notice", {
                message: "Column already added to layout",
                type: "error",
                timeout: 2000,
            });
            setDraggedColumn(null);
            return;
        }

        // Add to specified section
        const newField = {
            id: `field_${draggedColumn.id}_${Date.now()}`,
            columnId: draggedColumn.id,
            label: draggedColumn.title,
            type: draggedColumn.type,
            isDefault: false,
        };

        console.log("Adding field:", newField, "to section:", sectionId);

        setLayoutSections(
            layoutSections.map((section) => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        fields: [...section.fields, newField],
                    };
                }
                return section;
            }),
        );

        setDraggedColumn(null);
    };

    // ============================================
    // REMOVE FIELD FROM SECTION
    // ============================================
    const removeField = (sectionId, fieldId) => {
        const section = layoutSections.find((s) => s.id === sectionId);
        const field = section?.fields.find((f) => f.id === fieldId);

        if (field?.isDefault) {
            monday.execute("notice", {
                message: "Item Name field cannot be removed",
                type: "error",
                timeout: 2000,
            });
            return;
        }

        setLayoutSections(
            layoutSections.map((s) => {
                if (s.id === sectionId) {
                    return {
                        ...s,
                        fields: s.fields.filter((f) => f.id !== fieldId),
                    };
                }
                return s;
            }),
        );
    };

    // ============================================
    // CHECK IF COLUMN IS IN LAYOUT
    // ============================================
    const isColumnInLayout = (columnId) => {
        return layoutSections.some((section) => section.fields.some((field) => field.columnId === columnId));
    };

    // ============================================
    // INITIALIZE APP
    // ============================================
    useEffect(() => {
        monday.execute("valueCreatedForUser");

        monday.listen("context", async (res) => {
            setContext(res.data);

            const instance = res.data?.instanceId || `instance_${Date.now()}`;
            setInstanceId(instance);

            if (res.data && res.data.user) {
                const userRole = res.data.user.role || res.data.user.account_owner;
                setIsAdmin(userRole === "owner" || userRole === "admin" || res.data.user.account_owner === true);
            }

            if (res.data && res.data.boardId) {
                setBoardId(res.data.boardId);

                setLoading(true);
                try {
                    const query = `
                    query {
                      boards(ids: [${res.data.boardId}]) {
                        name
                        columns {
                          id
                          title
                          type
                        }
                      }
                    }
                  `;

                    const result = await monday.api(query);
                    if (result.data && result.data.boards && result.data.boards.length > 0) {
                        const boardData = result.data.boards[0];
                        const unsortedColumns = boardData.columns || [];
                        const fetchedBoardName = boardData.name || "Board";

                        setBoardName(fetchedBoardName);

                        const sortedColumns = [...unsortedColumns].sort((a, b) => {
                            if (a.title.toLowerCase() === b.title.toLowerCase()) {
                                return a.id.localeCompare(b.id);
                            }
                            return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
                        });

                        setColumns(sortedColumns);

                        await loadSavedLayout(instance);
                        await fetchChildBoards(res.data.boardId);
                    }
                } catch (error) {
                    console.error("Error fetching columns:", error);
                } finally {
                    setLoading(false);
                }
            }
        });
    }, []);

    // Track unsaved changes
    useEffect(() => {
        if (savedLayoutSections.length > 0) {
            const hasChanges = JSON.stringify(layoutSections) !== JSON.stringify(savedLayoutSections);
            setHasUnsavedChanges(hasChanges);
        }
    }, [layoutSections, savedLayoutSections]);

    // ============================================
    // FILTER FUNCTIONS
    // ============================================
    const filteredColumns = columns.filter(
        (column) =>
            column.title.toLowerCase().includes(searchColumnsQuery.toLowerCase()) || column.type.toLowerCase().includes(searchColumnsQuery.toLowerCase()),
    );

    const filteredChildBoards = childBoards.filter((item) => item.label.toLowerCase().includes(searchChildBoardsQuery.toLowerCase()));

    return (
        <Box className="App" backgroundColor="var(--primary-background-color)">
            {/* HEADER */}
            <Box marginBottom="large" padding="medium">
                <Flex align="center" justify="space-between" marginBottom="medium">
                    <Heading type="h1" weight="bold">
                        Monday Board Info
                    </Heading>
                    {isAdmin && (
                        <IconButton
                            kind="tertiary"
                            size="large"
                            icon={Settings}
                            onClick={() => setShowAdminPanel(!showAdminPanel)}
                            title="Customize form (Admin only)"
                        />
                    )}
                </Flex>

                {context && (
                    <Box marginBottom="medium">
                        <Text type="paragraph" color="var(--primary-text-color)">
                            <strong>User ID:</strong> {context.user?.id || "Loading..."}
                        </Text>
                    </Box>
                )}

                {boardId && (
                    <Box marginBottom="medium">
                        <Text type="paragraph" color="var(--primary-text-color)">
                            <strong>Here is the board id:</strong> {boardId}
                        </Text>
                    </Box>
                )}
            </Box>

            {/* ADMIN PANEL */}
            {showAdminPanel && isAdmin && (
                <Box
                    padding="medium"
                    marginBottom="medium"
                    style={{
                        backgroundColor: "rgba(0, 115, 234, 0.1)",
                        border: "1px solid var(--ui-border-color)",
                        borderRadius: "8px",
                    }}
                >
                    <Flex align="center" justify="space-between" marginBottom="medium">
                        <Heading type="h3" weight="bold">
                            Page Layout Editor
                        </Heading>
                        <button
                            onClick={() => setShowAdminPanel(false)}
                            style={{
                                cursor: "pointer",
                                padding: "4px 12px",
                                border: "1px solid var(--ui-border-color)",
                                borderRadius: "4px",
                                backgroundColor: "transparent",
                            }}
                        >
                            Close
                        </button>
                    </Flex>
                    <Text type="paragraph" color="var(--secondary-text-color)">
                        Drag columns into sections to customize the page layout. Changes are saved when you click "Save Layout".
                    </Text>
                </Box>
            )}

            {/* MAIN LAYOUT */}
            <Flex className="metadata-layout" align="Start">
                {/* LEFT SIDEBAR */}
                <Box className="sidebar">
                    <div
                        className={`nav-item ${selectedSection === "columns" ? "active" : ""}`}
                        onClick={() => setSelectedSection("columns")}
                        style={{ cursor: "pointer" }}
                    >
                        <Text type="paragraph" weight="bold">
                            Board Columns
                        </Text>
                    </div>

                    <div
                        className={`nav-item ${selectedSection === "childBoards" ? "active" : ""}`}
                        onClick={() => setSelectedSection("childBoards")}
                        style={{ cursor: "pointer" }}
                    >
                        <Text type="paragraph" weight="bold">
                            Child Boards
                        </Text>
                    </div>
                </Box>

                {/* RIGHT CONTENT AREA */}
                <Box className="main-content metadata-section">
                    {/* COLUMNS VIEW */}
                    {selectedSection === "columns" && (
                        <Box>
                            <Heading type="h2" weight="bold" marginBottom="medium">
                                Board Columns
                            </Heading>

                            {columns && columns.length > 0 && (
                                <Box marginBottom="medium">
                                    <TextField
                                        placeholder="Search columns by name or type..."
                                        value={searchColumnsQuery}
                                        onChange={(value) => setSearchColumnsQuery(value)}
                                        onClear={() => setSearchColumnsQuery("")}
                                    />
                                </Box>
                            )}

                            {loading ? (
                                <Flex align="center" gap="small">
                                    <Loader />
                                    <Text type="paragraph" color="var(--primary-text-color)">
                                        Loading columns...
                                    </Text>
                                </Flex>
                            ) : columns && columns.length > 0 ? (
                                <Box className="columns-container">
                                    {filteredColumns.length > 0 ? (
                                        filteredColumns.map((column) => {
                                            const inLayout = isColumnInLayout(column.id);
                                            return (
                                                <div
                                                    key={column.id}
                                                    draggable={!inLayout}
                                                    onDragStart={(e) => !inLayout && handleColumnDragStart(e, column)}
                                                    onMouseEnter={() => setHoveredColumnId(column.id)}
                                                    onMouseLeave={() => setHoveredColumnId(null)}
                                                    className={`column-card ${inLayout ? "disabled" : ""}`}
                                                    style={{
                                                        cursor: inLayout ? "not-allowed" : "grab",
                                                        opacity: inLayout ? 0.5 : 1,
                                                    }}
                                                >
                                                    <Box
                                                        padding="small"
                                                        backgroundColor="var(--secondary-background-color)"
                                                        border="1px solid var(--ui-border-color)"
                                                        borderRadius="var(--border-radius-small)"
                                                    >
                                                        <Flex align="center" justify="space-between">
                                                            <Text type="paragraph" color="var(--primary-text-color)">
                                                                <strong>{column.title}</strong>
                                                                {inLayout && <span style={{ marginLeft: "8px", fontSize: "12px" }}>(Added)</span>}
                                                            </Text>
                                                            {hoveredColumnId === column.id && !inLayout && (
                                                                <Text type="paragraph" color="var(--secondary-text-color)">
                                                                    ID: {column.id}
                                                                </Text>
                                                            )}
                                                        </Flex>
                                                    </Box>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <Text type="paragraph" color="var(--secondary-text-color)">
                                            No columns match your search.
                                        </Text>
                                    )}
                                </Box>
                            ) : (
                                <Text type="paragraph" color="var(--secondary-text-color)">
                                    No columns found or board not yet loaded.
                                </Text>
                            )}
                        </Box>
                    )}

                    {/* CHILD BOARDS VIEW */}
                    {selectedSection === "childBoards" && (
                        <Box>
                            <Heading type="h2" weight="bold" marginBottom="medium">
                                Child Boards
                            </Heading>

                            {childBoards && childBoards.length > 0 && (
                                <Box marginBottom="medium">
                                    <TextField
                                        placeholder="Search child boards by label..."
                                        value={searchChildBoardsQuery}
                                        onChange={(value) => setSearchChildBoardsQuery(value)}
                                        onClear={() => setSearchChildBoardsQuery("")}
                                    />
                                </Box>
                            )}

                            {loadingChildBoards ? (
                                <Flex align="center" gap="small">
                                    <Loader />
                                    <Text type="paragraph" color="var(--primary-text-color)">
                                        Loading child boards...
                                    </Text>
                                </Flex>
                            ) : childBoards && childBoards.length > 0 ? (
                                <Box className="columns-container">
                                    {filteredChildBoards.length > 0 ? (
                                        filteredChildBoards.map((item) => (
                                            <div
                                                key={item.id}
                                                onMouseEnter={() => setHoveredChildBoardId(item.id)}
                                                onMouseLeave={() => setHoveredChildBoardId(null)}
                                                className="column-card"
                                            >
                                                <Box
                                                    padding="small"
                                                    backgroundColor="var(--secondary-background-color)"
                                                    border="1px solid var(--ui-border-color)"
                                                    borderRadius="var(--border-radius-small)"
                                                >
                                                    <Flex align="center" justify="space-between">
                                                        <Text type="paragraph" color="var(--primary-text-color)">
                                                            <strong>{item.label}</strong>
                                                        </Text>
                                                        {hoveredChildBoardId === item.id && (
                                                            <Text type="paragraph" color="var(--secondary-text-color)">
                                                                Board: {item.boardId}
                                                            </Text>
                                                        )}
                                                    </Flex>
                                                </Box>
                                            </div>
                                        ))
                                    ) : (
                                        <Text type="paragraph" color="var(--secondary-text-color)">
                                            No child boards match your search.
                                        </Text>
                                    )}
                                </Box>
                            ) : (
                                <Text type="paragraph" color="var(--secondary-text-color)">
                                    No child boards found.
                                </Text>
                            )}
                        </Box>
                    )}
                </Box>
            </Flex>

            {/* LAYOUT SECTION - Page Layout Editor */}
            <Box className="layout-section">
                <Box padding="medium" borderTop="1px solid var(--ui-border-color)">
                    <Flex align="center" justify="space-between" marginBottom="medium">
                        <Heading type="h2" weight="bold">
                            Layout
                        </Heading>

                        {hasUnsavedChanges && (
                            <Flex gap="small">
                                <Button kind="tertiary" onClick={cancelLayoutChanges} disabled={savingLayout}>
                                    Cancel
                                </Button>
                                <Button kind="primary" onClick={saveLayout} loading={savingLayout} disabled={savingLayout}>
                                    Save Layout
                                </Button>
                            </Flex>
                        )}
                    </Flex>

                    <Box className="form-container">
                        {/* SECTIONS */}
                        {layoutSections.map((section) => (
                            <Box key={section.id} marginBottom="large" className="layout-section-container">
                                <Flex align="center" justify="space-between" marginBottom="medium">
                                    <Heading type="h3" weight="bold">
                                        {section.title}
                                    </Heading>
                                    {!section.isDefault && (
                                        <IconButton
                                            icon={CloseSmall}
                                            size="small"
                                            kind="tertiary"
                                            onClick={() => deleteSection(section.id)}
                                            ariaLabel="Delete section"
                                        />
                                    )}
                                </Flex>

                                {/* DROP ZONE - Field Labels Grid */}
                                <div
                                    className={`field-labels-grid section-drop-zone ${dragOverSectionId === section.id ? "drag-over" : ""}`}
                                    onDragOver={(e) => handleSectionDragOver(e, section.id)}
                                    onDragLeave={(e) => handleSectionDragLeave(e, section.id)}
                                    onDrop={(e) => handleSectionDrop(e, section.id)}
                                >
                                    {section.fields.length > 0 ? (
                                        section.fields.map((field) => (
                                            <div
                                                key={field.id}
                                                className="field-label-item"
                                                onMouseEnter={() => setHoveredFieldId(field.id)}
                                                onMouseLeave={() => setHoveredFieldId(null)}
                                            >
                                                <Flex
                                                    align="center"
                                                    justify="space-between"
                                                    style={{
                                                        padding: "12px",
                                                        borderRadius: "4px",
                                                        backgroundColor: "white",
                                                        border: "1px solid var(--ui-border-color)",
                                                        minHeight: "44px",
                                                    }}
                                                >
                                                    <Text type="paragraph" color="var(--primary-text-color)">
                                                        {field.label}
                                                    </Text>

                                                    {hoveredFieldId === field.id && !field.isDefault && (
                                                        <IconButton
                                                            icon={CloseSmall}
                                                            size="small"
                                                            kind="tertiary"
                                                            onClick={() => removeField(section.id, field.id)}
                                                            ariaLabel="Remove field"
                                                        />
                                                    )}

                                                    {field.isDefault && hoveredFieldId === field.id && (
                                                        <Text size="small" color="var(--secondary-text-color)">
                                                            Required
                                                        </Text>
                                                    )}
                                                </Flex>
                                            </div>
                                        ))
                                    ) : (
                                        <Box
                                            padding="large"
                                            style={{
                                                gridColumn: "1 / -1",
                                                border: "2px dashed var(--ui-border-color)",
                                                borderRadius: "8px",
                                                textAlign: "center",
                                                backgroundColor: "rgba(0, 115, 234, 0.03)",
                                                minHeight: "100px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Text color="var(--secondary-text-color)">Drag columns here to add them to this section</Text>
                                        </Box>
                                    )}
                                </div>
                            </Box>
                        ))}

                        {/* NEW SECTION BUTTON */}
                        <Button kind="secondary" onClick={() => setShowNewSectionDialog(true)} style={{ width: "100%" }}>
                            <Flex align="center" justify="center" gap="small">
                                <Add />
                                <Text>New Section</Text>
                            </Flex>
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* NEW SECTION DIALOG */}
            {showNewSectionDialog && (
                <Box
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10000,
                    }}
                    onClick={() => setShowNewSectionDialog(false)}
                >
                    <Box
                        padding="large"
                        borderRadius="12px"
                        style={{
                            minWidth: "400px",
                            backgroundColor: "#FFFFFF",
                            boxShadow: "0px 15px 50px rgba(0, 0, 0, 0.3)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Heading type="h2" weight="bold" marginBottom="medium">
                            Create New Section
                        </Heading>

                        <Box marginBottom="medium">
                            <TextField placeholder="Enter section name" value={newSectionName} onChange={(value) => setNewSectionName(value)} autoFocus />
                        </Box>

                        <Flex gap="medium" justify="flex-end">
                            <Button
                                kind="tertiary"
                                onClick={() => {
                                    setShowNewSectionDialog(false);
                                    setNewSectionName("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button kind="primary" onClick={createNewSection}>
                                Create Section
                            </Button>
                        </Flex>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default App;
